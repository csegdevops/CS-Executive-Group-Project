import { requireModuleAccess } from "@/lib/auth-helpers"
import { createAdminClient } from "@/lib/supabase/admin"
import { PageHeader } from "@/components/layout/PageHeader"
import { ContractorsListClient } from "./ContractorsListClient"

export default async function ContractorsPage() {
  await requireModuleAccess("recruitment")

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: contracts } = await (admin.schema("recruitment") as any)
    .from("contracts")
    .select(`
      id, contract_number, status, created_at, award, award_level, pay_rate, start_date, finish_date,
      placement:placements(
        id, start_date, finish_date, pay_rate, charge_rate, currency,
        job:jobs(id, title, company_id),
        candidate:candidates(id, first_name, last_name)
      )
    `)
    .eq("is_current", true)
    .order("created_at", { ascending: false })

  const companyIds = [
    ...new Set(
      (contracts ?? [])
        .map((c: { placement?: { job?: { company_id: string } } }) => c.placement?.job?.company_id)
        .filter(Boolean)
    ),
  ] as string[]
  const { data: companies } = companyIds.length
    ? await admin.from("companies").select("id, name").in("id", companyIds)
    : { data: [] }
  const companyMap = Object.fromEntries((companies ?? []).map((c: { id: string; name: string }) => [c.id, c.name]))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enriched = (contracts ?? []).map((c: any) => ({
    id: c.id,
    contract_number: c.contract_number,
    status: c.status,
    finish_date: c.finish_date ?? c.placement?.finish_date ?? null,
    start_date: c.start_date ?? c.placement?.start_date ?? null,
    award: c.award,
    award_level: c.award_level,
    pay_rate: c.pay_rate ?? c.placement?.pay_rate ?? null,
    candidate_name: c.placement?.candidate ? `${c.placement.candidate.first_name} ${c.placement.candidate.last_name}` : "Unknown",
    job_title: c.placement?.job?.title ?? null,
    company_id: c.placement?.job?.company_id ?? null,
    company_name: c.placement?.job?.company_id ? companyMap[c.placement.job.company_id] ?? null : null,
  }))

  const companyOptions = Object.entries(companyMap).map(([id, name]) => ({ id, name: name as string }))

  return (
    <div>
      <PageHeader title="Contractors" description="Everyone currently or previously on a contract placement" />
      <ContractorsListClient contracts={enriched} companyOptions={companyOptions} />
    </div>
  )
}
