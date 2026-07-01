import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { PageHeader } from "@/components/layout/PageHeader"
import { LookupValuesManager } from "@/components/lookup-values/LookupValuesManager"
import type { LookupValueRow } from "@/components/lookup-values/LookupValuesManager"

export default async function AdminReferenceDataPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (profile?.role !== "super_admin") redirect("/")

  const { data } = await supabase
    .from("lookup_values")
    .select("id, scope, category, value, label, sort_order, is_active")
    .in("scope", ["global", "recruitment", "regulatory", "timesheets"])
    .order("category")
    .order("sort_order")
    .order("label")

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Reference Data"
        description="Manage dropdown options across all modules."
      />
      <LookupValuesManager
        initialValues={(data ?? []) as LookupValueRow[]}
        visibleScopes={["global", "recruitment", "regulatory", "timesheets"]}
        moduleScope={null}
      />
    </div>
  )
}
