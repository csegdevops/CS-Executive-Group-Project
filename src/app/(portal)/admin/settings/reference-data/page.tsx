import { createClient } from "@/lib/supabase/server"
import { requireSuperAdmin } from "@/lib/auth-helpers"
import { BackButton } from "../groups/BackButton"
import { PageHeader } from "@/components/layout/PageHeader"
import { LookupValuesManager } from "@/components/lookup-values/LookupValuesManager"
import type { LookupValueRow } from "@/components/lookup-values/LookupValuesManager"

const VISIBLE_SCOPES = ["global", "regulatory", "recruitment"] as const

// Was previously implicit via the parent /admin layout's blanket
// requireSuperAdmin() — that layout gate is now permission-based, so this
// page needs its own explicit check to keep its access level unchanged.
// (Its mutations already have proper granular checks via can_manage_lookup()
// in the lookup-values API routes; making the page itself reachable via
// those same granular permissions is a separate, deferred piece of work.)
export default async function ReferenceDataPage() {
  await requireSuperAdmin()
  const supabase = await createClient()
  const { data } = await supabase
    .from("lookup_values")
    .select("id, scope, category, value, label, sort_order, is_active")
    .in("scope", VISIBLE_SCOPES)
    .order("category")
    .order("sort_order")
    .order("label")

  return (
    <div className="max-w-3xl space-y-6">
      <BackButton />
      <PageHeader
        title="Reference Data"
        description="Manage dropdown options across all modules."
      />
      <LookupValuesManager
        initialValues={(data ?? []) as LookupValueRow[]}
        visibleScopes={[...VISIBLE_SCOPES]}
      />
    </div>
  )
}
