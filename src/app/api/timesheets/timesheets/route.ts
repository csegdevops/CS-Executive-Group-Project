import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import type { TimesheetStatus } from "@/types/database"

const VALID_STATUSES: TimesheetStatus[] = ["draft", "submitted", "approved", "declined"]

// GET /api/timesheets/timesheets?status=submitted,approved — internal
// oversight list across every contractor, not scoped to one supervisor.
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const statusParam = req.nextUrl.searchParams.get("status")
  const statuses = statusParam
    ? statusParam.split(",").filter((s): s is TimesheetStatus => VALID_STATUSES.includes(s as TimesheetStatus))
    : null

  const admin = createAdminClient()
  const ts = admin.schema("timesheets")

  let query = ts
    .from("timesheets")
    .select("id, contractor_id, week_starting, status, decline_reason, submitted_at, approved_at, declined_at, supervisor_id")
    .eq("is_template", false)
    .order("submitted_at", { ascending: false, nullsFirst: false })

  if (statuses) query = query.in("status", statuses)

  const { data: timesheets, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const contractorIds = [...new Set((timesheets ?? []).map((t) => t.contractor_id))]
  const { data: contractors } = contractorIds.length
    ? await ts.from("contractors").select("id, full_name, company_id").in("id", contractorIds)
    : { data: [] }
  const contractorMap = Object.fromEntries((contractors ?? []).map((c) => [c.id, c]))

  const companyIds = [...new Set((contractors ?? []).map((c) => c.company_id))]
  const { data: companies } = companyIds.length
    ? await admin.from("companies").select("id, name").in("id", companyIds)
    : { data: [] }
  const companyMap = Object.fromEntries((companies ?? []).map((c) => [c.id, c.name]))

  const supervisorIds = [...new Set((timesheets ?? []).map((t) => t.supervisor_id).filter(Boolean))] as string[]
  const { data: supervisors } = supervisorIds.length
    ? await ts.from("supervisors").select("id, full_name").in("id", supervisorIds)
    : { data: [] }
  const supervisorMap = Object.fromEntries((supervisors ?? []).map((s) => [s.id, s.full_name]))

  const result = (timesheets ?? []).map((t) => {
    const contractor = contractorMap[t.contractor_id]
    return {
      ...t,
      contractor_name: contractor?.full_name ?? null,
      company_name: contractor ? companyMap[contractor.company_id] ?? null : null,
      supervisor_name: t.supervisor_id ? supervisorMap[t.supervisor_id] ?? null : null,
    }
  })

  return NextResponse.json(result)
}
