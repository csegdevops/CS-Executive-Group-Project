import { NextRequest, NextResponse, after } from "next/server"
import { createHmac, timingSafeEqual } from "crypto"
import { createAdminClient } from "@/lib/supabase/admin"
import { ingestCv } from "@/lib/cv-parsing/ingest"
import { z } from "zod"

// CV parsing (in the after() callback below) can take well over a minute for
// a dense resume — see src/lib/cv-parsing/gemini.ts.
export const maxDuration = 180

/**
 * PUBLIC endpoint — no Supabase session required.
 * Receives full candidate profile pushes from the UniWorks student-matching
 * platform. Always tags the resulting candidate with source_channel =
 * "uniworks" (server-side, not client-supplied) so these are distinguishable
 * from every other intake channel everywhere source_channel is displayed.
 *
 * Security: every request must be signed with UNIWORKS_IMPORT_SECRET —
 * header "x-uniworks-signature: <sha256-hmac hex digest of the raw body>".
 * Unlike /api/public/apply (where the equivalent GRAVITY_FORMS_SECRET check
 * is optional/back-compat), this is a brand-new endpoint with no legacy
 * callers, so the signature is mandatory.
 */

const importSchema = z.object({
  email:                z.string().email(),
  first_name:           z.string().min(1),
  last_name:            z.string().min(1),
  phone:                z.string().optional(),
  secondary_email:      z.string().email().optional(),
  linkedin_url:         z.string().url().optional(),
  location_city:        z.string().optional(),
  location_state:       z.string().optional(),
  location_postcode:    z.string().optional(),
  location_country:     z.string().default("AU"),
  address_line:         z.string().optional(),
  employment_status:    z.enum(["employed", "not_working"]).optional(),
  citizenship_status:   z.string().optional(),
  preferred_work_types: z.array(z.string()).optional(),
  current_title:        z.string().optional(),
  current_employer:     z.string().optional(),
  work_email:           z.string().email().optional(),
  current_salary:       z.number().nonnegative().optional(),
  base_salary_expected: z.string().optional(),
  field_of_study:       z.string().optional(),
  education_tags:       z.array(z.string()).optional(),
  skills_tags:          z.array(z.string()).optional(),
  raw_resume_text:      z.string().optional(),
  cv_url:               z.string().url().optional(),
  // Catch-all for anything UniWorks holds that has no dedicated column
  // (course name, institution, expected graduation year, availability,
  // consent flags, etc.) — never dropped, always persisted.
  self_reported_metadata: z.record(z.string(), z.unknown()).optional(),
  // Re-push an already-imported candidate with refreshed values (non-null
  // fields overwrite; omitted/blank fields never wipe existing data).
  // Defaults to false — first push always just fills in.
  overwrite: z.boolean().default(false),
})

function verifySignature(rawBody: string, signature: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex")
  const expectedBuf = Buffer.from(expected, "hex")
  const providedBuf = Buffer.from(signature, "hex")
  if (expectedBuf.length !== providedBuf.length) return false
  return timingSafeEqual(expectedBuf, providedBuf)
}

export async function POST(req: NextRequest) {
  const secret = process.env.UNIWORKS_IMPORT_SECRET
  if (!secret) {
    return NextResponse.json({ error: "Import endpoint not configured" }, { status: 500 })
  }

  const signature = req.headers.get("x-uniworks-signature")
  const rawBody = await req.text()
  if (!signature || !verifySignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  const body = JSON.parse(rawBody)
  const parsed = importSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid candidate data", details: parsed.error.flatten() }, { status: 400 })
  }
  const data = parsed.data

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: upsertResult, error: upsertError } = await (admin.schema("recruitment") as any)
    .rpc("upsert_candidate", {
      p_email:                 data.email,
      p_phone:                 data.phone ?? null,
      p_first_name:            data.first_name,
      p_last_name:             data.last_name,
      p_current_title:         data.current_title ?? null,
      p_current_employer:      data.current_employer ?? null,
      p_location_city:         data.location_city ?? null,
      p_location_state:        data.location_state ?? null,
      p_location_country:      data.location_country,
      p_raw_resume_text:       data.raw_resume_text ?? null,
      p_skills_tags:           data.skills_tags?.length ? data.skills_tags : null,
      p_field_of_study:        data.field_of_study ?? null,
      p_source_channel:        "uniworks",
      p_added_by:              null,
      p_linkedin_url:          data.linkedin_url ?? null,
      p_current_salary:        data.current_salary ?? null,
      p_base_salary_expected:  data.base_salary_expected ?? null,
      p_overwrite:             data.overwrite,
      p_self_reported_metadata: data.self_reported_metadata ?? null,
    })

  if (upsertError) {
    console.error("[uniworks-import] upsert failed", upsertError)
    return NextResponse.json({ error: "Could not process candidate" }, { status: 500 })
  }

  const candidateId = upsertResult?.[0]?.candidate_id
  const action = upsertResult?.[0]?.action

  // Columns the RPC doesn't accept a parameter for — set directly, honoring
  // the same overwrite/fill-blanks semantics as the RPC (never silently
  // clobber existing data on a non-overwrite re-push).
  const extraFields = ["secondary_email", "location_postcode", "address_line", "work_email",
    "employment_status", "citizenship_status", "preferred_work_types", "education_tags"] as const
  const submittedExtras: Partial<Record<typeof extraFields[number], unknown>> = {
    secondary_email: data.secondary_email,
    location_postcode: data.location_postcode,
    address_line: data.address_line,
    work_email: data.work_email,
    employment_status: data.employment_status,
    citizenship_status: data.citizenship_status,
    preferred_work_types: data.preferred_work_types,
    education_tags: data.education_tags,
  }

  if (Object.values(submittedExtras).some((v) => v !== undefined)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recruitment = admin.schema("recruitment") as any
    const { data: existing } = await recruitment
      .from("candidates")
      .select(extraFields.join(","))
      .eq("id", candidateId)
      .single()

    const isEmpty = (v: unknown) => v == null || (Array.isArray(v) && v.length === 0)
    const directUpdate: Record<string, unknown> = {}
    for (const field of extraFields) {
      const submitted = submittedExtras[field]
      if (submitted === undefined) continue
      if (data.overwrite || isEmpty(existing?.[field])) directUpdate[field] = submitted
    }

    if (Object.keys(directUpdate).length > 0) {
      await recruitment.from("candidates").update(directUpdate).eq("id", candidateId)
    }
  }

  if (data.cv_url) {
    const cvUrl = data.cv_url
    after(() =>
      ingestCv({ candidateId, docType: "cv", source: { url: cvUrl } })
        .catch((err) => console.error("[uniworks-import] CV ingest failed", err))
    )
  }

  return NextResponse.json(
    { status: "ok", candidate_id: candidateId, action },
    { status: action === "inserted" ? 201 : 200 }
  )
}
