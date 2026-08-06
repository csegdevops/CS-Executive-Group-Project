import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// GET /api/timesheets/contractors/[id] — contractor + contract + supervisor
// history + recent timesheets, for the back-office detail page.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()
  const ts = admin.schema("timesheets")

  const { data: contractor, error } = await ts.from("contractors").select("*").eq("id", id).single()
  if (error || !contractor) return NextResponse.json({ error: "Contractor not found" }, { status: 404 })

  const { data: company } = await admin.from("companies").select("id, name").eq("id", contractor.company_id).single()
  const { data: branch } = contractor.branch_id
    ? await admin.from("company_branches").select("id, name").eq("id", contractor.branch_id).single()
    : { data: null }

  const { data: contract } = await ts.from("contracts").select("*").eq("contractor_id", id).single()
  const { data: contractEvents } = contract
    ? await ts.from("contract_events").select("*").eq("contract_id", contract.id).order("created_at", { ascending: false })
    : { data: [] }

  const { data: assignments } = await ts
    .from("supervisor_assignments")
    .select("id, supervisor_id, start_date, end_date")
    .eq("contractor_id", id)
    .order("start_date", { ascending: false })

  const supervisorIds = [...new Set((assignments ?? []).map((a) => a.supervisor_id))]
  const { data: supervisors } = supervisorIds.length
    ? await ts.from("supervisors").select("id, full_name, email, company_id").in("id", supervisorIds)
    : { data: [] }
  const supervisorMap = Object.fromEntries((supervisors ?? []).map((s) => [s.id, s]))

  const assignmentHistory = (assignments ?? []).map((a) => ({
    ...a,
    supervisor: supervisorMap[a.supervisor_id] ?? null,
  }))
  const activeAssignment = assignmentHistory.find((a) => !a.end_date) ?? null

  const { data: timesheets } = await ts
    .from("timesheets")
    .select("id, week_starting, status, submitted_at, approved_at, declined_at")
    .eq("contractor_id", id)
    .eq("is_template", false)
    .order("week_starting", { ascending: false })
    .limit(20)

  return NextResponse.json({
    contractor,
    company,
    branch,
    contract,
    contract_events: contractEvents ?? [],
    active_supervisor: activeAssignment?.supervisor ?? null,
    supervisor_history: assignmentHistory,
    timesheets: timesheets ?? [],
  })
}
