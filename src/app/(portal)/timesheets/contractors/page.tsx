import { requireModuleAccess } from "@/lib/auth-helpers"
import { createAdminClient } from "@/lib/supabase/admin"
import { PageHeader } from "@/components/layout/PageHeader"
import { ContractorsListClient } from "./ContractorsListClient"

export default async function ContractorsPage() {
  await requireModuleAccess("timesheets")
  const admin = createAdminClient()
  const ts = admin.schema("timesheets")

  const { data: contractors } = await ts
    .from("contractors")
    .select("id, full_name, email, company_id, branch_id, is_active, created_at")
    .order("created_at", { ascending: false })

  const { data: companies } = await admin.from("companies").select("id, name").eq("is_active", true).order("name")
  const companyMap = Object.fromEntries((companies ?? []).map((c) => [c.id, c.name]))

  const contractorIds = (contractors ?? []).map((c) => c.id)
  const { data: contracts } = contractorIds.length
    ? await ts.from("contracts").select("contractor_id, status, finish_date").in("contractor_id", contractorIds)
    : { data: [] }
  const contractMap = Object.fromEntries((contracts ?? []).map((c) => [c.contractor_id, c]))

  const rows = (contractors ?? []).map((c) => ({
    ...c,
    company_name: companyMap[c.company_id] ?? "—",
    contract_status: contractMap[c.id]?.status ?? null,
  }))

  return (
    <div>
      <PageHeader title="Contractors" description="Contractor timesheet-portal logins and their contracts" />
      <ContractorsListClient initialContractors={rows} companies={companies ?? []} />
    </div>
  )
}
