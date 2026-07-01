import { requireModuleAccess } from "@/lib/auth-helpers"
import { createAdminClient } from "@/lib/supabase/admin"
import { PageHeader } from "@/components/layout/PageHeader"
import { PipelineBoard } from "./PipelineBoard"

export default async function PipelinePage() {
  await requireModuleAccess("crm")
  const admin = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: opps } = await (admin.schema("crm") as any)
    .from("opportunities")
    .select("*")
    .not("stage", "in", '("won","lost")')
    .order("created_at", { ascending: false })

  const companyIds = [...new Set((opps ?? []).map((o: { company_id: string }) => o.company_id))] as string[]
  const assigneeIds = [...new Set((opps ?? []).map((o: { assigned_to: string | null }) => o.assigned_to).filter(Boolean))] as string[]

  const [{ data: companies }, { data: profiles }] = await Promise.all([
    companyIds.length ? admin.from("companies").select("id, name").in("id", companyIds) : { data: [] },
    assigneeIds.length ? admin.from("profiles").select("id, full_name").in("id", assigneeIds) : { data: [] },
  ])

  const companyMap = Object.fromEntries((companies ?? []).map((c: { id: string; name: string }) => [c.id, c.name]))
  const profileMap = Object.fromEntries((profiles ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name]))

  const enriched = (opps ?? []).map((o: Record<string, unknown>) => ({
    ...o,
    company_name: companyMap[o.company_id as string] ?? "Unknown",
    assigned_to_name: o.assigned_to ? (profileMap[o.assigned_to as string] ?? null) : null,
  }))

  return (
    <div>
      <PageHeader title="Pipeline" description="Business development opportunities by stage" />
      <PipelineBoard initialOpps={enriched} />
    </div>
  )
}
