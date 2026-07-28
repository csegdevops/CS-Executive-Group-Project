import { requireModuleAccess } from "@/lib/auth-helpers"
import { createAdminClient } from "@/lib/supabase/admin"
import { PageHeader } from "@/components/layout/PageHeader"
import { findDuplicateClusters } from "@/lib/recruitment/find-duplicate-clusters"
import { DuplicatesClient } from "./DuplicatesClient"

export default async function CandidateDuplicatesPage() {
  await requireModuleAccess("recruitment")
  const admin = createAdminClient()
  const { clusters, scanned } = await findDuplicateClusters(admin)

  return (
    <div>
      <PageHeader
        title="Possible Duplicate Candidates"
        description={`${clusters.length} possible duplicate group${clusters.length !== 1 ? "s" : ""} found across ${scanned} active candidate${scanned !== 1 ? "s" : ""}`}
      />
      <DuplicatesClient clusters={clusters} />
    </div>
  )
}
