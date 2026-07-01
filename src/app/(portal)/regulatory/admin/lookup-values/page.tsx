import { requireModuleAccess } from "@/lib/auth-helpers"
import { createClient } from "@/lib/supabase/server"
import { LookupValuesManager } from "@/components/lookup-values/LookupValuesManager"
import type { LookupValueRow } from "@/components/lookup-values/LookupValuesManager"

export default async function RegulatoryReferenceDataPage() {
  await requireModuleAccess("regulatory")

  const supabase = await createClient()
  const { data } = await supabase
    .from("lookup_values")
    .select("id, scope, category, value, label, sort_order, is_active")
    .in("scope", ["global", "recruitment", "regulatory", "timesheets"])
    .order("category")
    .order("sort_order")
    .order("label")

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Reference Data</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage dropdown options across all modules.
        </p>
      </div>
      <LookupValuesManager
        initialValues={(data ?? []) as LookupValueRow[]}
        visibleScopes={["global", "recruitment", "regulatory", "timesheets"]}
        moduleScope="regulatory"
      />
    </div>
  )
}
