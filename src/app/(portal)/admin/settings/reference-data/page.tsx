import { createClient } from "@/lib/supabase/server"
import { BackButton } from "../groups/BackButton"
import { PageHeader } from "@/components/layout/PageHeader"
import { LookupValuesManager } from "@/components/lookup-values/LookupValuesManager"
import type { LookupValueRow } from "@/components/lookup-values/LookupValuesManager"

const VISIBLE_SCOPES = ["global", "regulatory", "recruitment", "crm"] as const

export default async function ReferenceDataPage() {
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
        moduleScope={null}
      />
    </div>
  )
}
