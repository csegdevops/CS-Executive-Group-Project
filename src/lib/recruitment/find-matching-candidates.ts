import { createAdminClient } from "@/lib/supabase/admin"

export interface MatchingCandidate {
  id: string
  first_name: string
  last_name: string
  email: string
  current_title: string | null
  profile_completeness_pct: number
  matched_skills: string[]
  matched_education_tags: string[]
  match_count: number
  match_pct: number
  already_applied: boolean
}

/**
 * Ranks active candidates against a job's required skills/education tags by
 * overlap count. Small recruitment-firm dataset (same reasoning as
 * find-duplicate-clusters) — plain in-memory comparison, no SQL array
 * overlap operators needed.
 */
export async function findMatchingCandidates(
  admin: ReturnType<typeof createAdminClient>,
  jobId: string,
  requiredSkills: string[],
  requiredEducationTags: string[]
): Promise<MatchingCandidate[]> {
  const totalRequired = requiredSkills.length + requiredEducationTags.length
  if (totalRequired === 0) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recruitment = admin.schema("recruitment") as any

  const [{ data: candidates }, { data: existingApps }] = await Promise.all([
    recruitment
      .from("candidates")
      .select("id, first_name, last_name, email, current_title, profile_completeness_pct, skills_tags, education_tags")
      .eq("is_active", true),
    recruitment.from("applications").select("candidate_id").eq("job_id", jobId),
  ])

  const appliedIds = new Set(((existingApps ?? []) as { candidate_id: string }[]).map((a) => a.candidate_id))
  const skillSet = new Set(requiredSkills)
  const eduSet = new Set(requiredEducationTags)

  const results: MatchingCandidate[] = []
  for (const c of (candidates ?? []) as Array<{
    id: string
    first_name: string
    last_name: string
    email: string
    current_title: string | null
    profile_completeness_pct: number
    skills_tags: string[]
    education_tags: string[]
  }>) {
    const matchedSkills = (c.skills_tags ?? []).filter((s) => skillSet.has(s))
    const matchedEducation = (c.education_tags ?? []).filter((e) => eduSet.has(e))
    const matchCount = matchedSkills.length + matchedEducation.length
    if (matchCount === 0) continue

    results.push({
      id: c.id,
      first_name: c.first_name,
      last_name: c.last_name,
      email: c.email,
      current_title: c.current_title,
      profile_completeness_pct: c.profile_completeness_pct,
      matched_skills: matchedSkills,
      matched_education_tags: matchedEducation,
      match_count: matchCount,
      match_pct: Math.round((matchCount / totalRequired) * 100),
      already_applied: appliedIds.has(c.id),
    })
  }

  results.sort((a, b) => b.match_pct - a.match_pct || b.match_count - a.match_count)
  return results
}
