import { requireModuleAccess } from "@/lib/auth-helpers"
import { createAdminClient } from "@/lib/supabase/admin"
import { PageHeader } from "@/components/layout/PageHeader"
import { CandidatesClient } from "./CandidatesClient"
import { findDuplicateClusters } from "@/lib/recruitment/find-duplicate-clusters"

export default async function CandidatesPage() {
  await requireModuleAccess("recruitment")
  const admin = createAdminClient()

  const [{ data: candidates }, { clusters }] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin.schema("recruitment") as any)
      .from("candidates")
      .select(`
        id, first_name, last_name, email, phone,
        current_title, current_employer,
        location_city, location_state,
        skills_tags, security_clearance_level, security_clearance_verified,
        profile_completeness_pct, cv_parse_status, source_channel,
        is_active, created_at
      `)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(500),
    findDuplicateClusters(admin),
  ])

  return (
    <div>
      <PageHeader title="Candidates" description="Talent pool" />
      <CandidatesClient candidates={candidates ?? []} duplicateClusterCount={clusters.length} />
    </div>
  )
}
