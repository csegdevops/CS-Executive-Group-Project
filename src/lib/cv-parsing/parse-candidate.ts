import { createAdminClient } from "@/lib/supabase/admin"
import { isAiPaused, AI_PAUSED_MESSAGE } from "@/lib/ai/pause"
import { prepareDocumentInput } from "./extract"
import { cvParser } from "./index"
import { inferCountryFromPhone } from "./infer-country-from-phone"
import type { CvParseVocabulary } from "./types"

function union(existing: string[] | null | undefined, additions: string[]): string[] {
  return Array.from(new Set([...(existing ?? []), ...additions]))
}

// Parses a candidate's already-stored CV and non-destructively fills profile
// fields (COALESCE-style, matching upsert_candidate's merge behavior).
// skills_tags/education_tags are merged additively (union) rather than
// overwritten — a recruiter's manual tags are never removed by a (re-)parse.
// Throws on failure (after marking cv_parse_status = 'failed') — callers that
// want a "log and continue" posture (e.g. ingestCv, right after a fresh
// upload) should catch; callers driven by an explicit user action (the
// re-parse button) let it propagate so the UI can show a real error.
export async function parseCandidateCv(candidateId: string, buffer: Buffer, mimeType: string): Promise<void> {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recruitment = admin.schema("recruitment") as any

  console.log(`[parse-candidate] ${candidateId} started, buffer=${buffer.length} bytes, mimeType=${mimeType}`)
  try {
    if (await isAiPaused()) throw new Error(AI_PAUSED_MESSAGE)

    await recruitment.from("candidates").update({ cv_parse_status: "pending" }).eq("id", candidateId)

    const { data: lookups } = await admin
      .from("lookup_values")
      .select("category, value")
      .eq("scope", "recruitment")
      .in("category", ["skill_tag", "education_field"])
      .eq("is_active", true)

    const vocabulary: CvParseVocabulary = {
      skillTags: (lookups ?? []).filter((l: { category: string }) => l.category === "skill_tag").map((l: { value: string }) => l.value),
      educationFields: (lookups ?? []).filter((l: { category: string }) => l.category === "education_field").map((l: { value: string }) => l.value),
    }
    console.log(`[parse-candidate] ${candidateId} vocab loaded: ${vocabulary.skillTags.length} skills, ${vocabulary.educationFields.length} education fields`)

    const input = await prepareDocumentInput(buffer, mimeType)
    console.log(`[parse-candidate] ${candidateId} document prepared, kind=${input.kind}, calling cvParser.parseResume...`)
    const parsed = await cvParser.parseResume(input, vocabulary)
    console.log(`[parse-candidate] ${candidateId} parseResume resolved`)

    const { data: current } = await recruitment
      .from("candidates")
      .select("location_city, location_state, location_country, phone, field_of_study, skills_tags, education_tags")
      .eq("id", candidateId)
      .single()

    const mergedCity  = current?.location_city  ?? parsed.location_city  ?? null
    const mergedState = current?.location_state ?? parsed.location_state ?? null
    const mergedPhone = current?.phone           ?? parsed.phone          ?? null

    // Infer country from the phone's dialing prefix only when location is
    // genuinely unknown (both city AND state absent — either one alone means
    // it's at least partially known and a phone-prefix guess shouldn't
    // override it) and location_country is still the untouched 'AU' default
    // — never clobber a value a recruiter set manually or a prior parse
    // already inferred, matching this function's COALESCE-style "never
    // overwrite known data" posture.
    let locationCountry: string | undefined
    if (mergedCity === null && mergedState === null && current?.location_country === "AU") {
      const inferred = inferCountryFromPhone(mergedPhone)
      if (inferred && inferred !== "AU") locationCountry = inferred
    }

    // current_title/current_employer are deliberately NOT touched here —
    // they only ever auto-update when a candidate is actually placed (see
    // trg_update_candidate_on_placement), since CV-reported title/employer
    // is unverified. The full work history (including title/employer per
    // role) is still preserved in parsed_metadata.work_experience below.
    await recruitment
      .from("candidates")
      .update({
        raw_resume_text: parsed.raw_text || null,
        parsed_metadata: { education: parsed.education, work_experience: parsed.work_experience, skills: parsed.skills },
        cv_parse_status: "parsed",
        cv_parsed_by: "gemini",
        cv_parsed_at: new Date().toISOString(),
        phone: mergedPhone,
        location_city: mergedCity,
        location_state: mergedState,
        location_country: locationCountry,
        field_of_study: current?.field_of_study ?? parsed.education[0]?.field_of_study ?? null,
        skills_tags: union(current?.skills_tags, parsed.matched_skill_tags),
        education_tags: union(current?.education_tags, parsed.matched_education_tags),
      })
      .eq("id", candidateId)
  } catch (err) {
    await recruitment.from("candidates").update({ cv_parse_status: "failed" }).eq("id", candidateId)
    throw err
  }
}
