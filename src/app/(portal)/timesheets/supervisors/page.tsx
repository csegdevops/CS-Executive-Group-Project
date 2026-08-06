import { requireModuleAccess } from "@/lib/auth-helpers"
import { createAdminClient } from "@/lib/supabase/admin"
import { PageHeader } from "@/components/layout/PageHeader"
import { SupervisorsListClient } from "./SupervisorsListClient"

export default async function SupervisorsPage() {
  await requireModuleAccess("timesheets")
  const admin = createAdminClient()
  const ts = admin.schema("timesheets")

  const { data: supervisors } = await ts
    .from("supervisors")
    .select("id, full_name, email, company_id, is_active, created_at")
    .order("created_at", { ascending: false })

  const { data: companies } = await admin.from("companies").select("id, name").eq("is_active", true).order("name")
  const companyMap = Object.fromEntries((companies ?? []).map((c) => [c.id, c.name]))

  const supervisorIds = (supervisors ?? []).map((s) => s.id)
  const { data: activeAssignments } = supervisorIds.length
    ? await ts.from("supervisor_assignments").select("supervisor_id").in("supervisor_id", supervisorIds).is("end_date", null)
    : { data: [] }
  const activeCount: Record<string, number> = {}
  for (const a of activeAssignments ?? []) activeCount[a.supervisor_id] = (activeCount[a.supervisor_id] ?? 0) + 1

  const rows = (supervisors ?? []).map((s) => ({
    ...s,
    company_name: companyMap[s.company_id] ?? "—",
    active_contractor_count: activeCount[s.id] ?? 0,
  }))

  return (
    <div>
      <PageHeader title="Supervisors" description="Client-side supervisors who approve contractor timesheets" />
      <SupervisorsListClient initialSupervisors={rows} companies={companies ?? []} />
    </div>
  )
}
