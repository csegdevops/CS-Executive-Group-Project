import { NextRequest, NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth-helpers"
import { createAdminClient } from "@/lib/supabase/admin"

// GET /api/timesheets-portal/timesheets/[id] — detail + entries. Available to
// the owning contractor or their currently-assigned supervisor (approvals
// view); anyone else gets 404 rather than 403 to avoid confirming existence.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser()
  if (!user || user.user_type === "internal") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()
  const ts = admin.schema("timesheets")

  const { data: timesheet, error } = await ts.from("timesheets").select("*").eq("id", id).single()
  if (error || !timesheet) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { data: contractor } = await ts.from("contractors").select("id, full_name, company_id, user_id").eq("id", timesheet.contractor_id).single()

  const isOwner = user.user_type === "contractor" && contractor?.user_id === user.id
  let isAssignedSupervisor = false
  if (user.user_type === "supervisor" && !isOwner) {
    const { data: supervisor } = await ts.from("supervisors").select("id").eq("user_id", user.id).single()
    isAssignedSupervisor = !!supervisor && supervisor.id === timesheet.supervisor_id
  }
  if (!isOwner && !isAssignedSupervisor) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { data: entries } = await ts.from("timesheet_entries").select("*").eq("timesheet_id", id).order("work_date")
  const { data: events } = await ts.from("timesheet_events").select("*").eq("timesheet_id", id).order("created_at", { ascending: false })

  return NextResponse.json({ timesheet, contractor, entries: entries ?? [], events: events ?? [] })
}
