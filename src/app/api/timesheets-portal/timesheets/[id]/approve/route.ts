import { NextRequest, NextResponse } from "next/server"
import { requireSupervisorAuth } from "@/lib/auth-helpers"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendTimesheetApprovedEmail } from "@/lib/email/notifications/timesheets"

// POST /api/timesheets-portal/timesheets/[id]/approve — only the currently
// assigned supervisor for a submitted timesheet may approve it.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireSupervisorAuth()
  const { id } = await params

  const admin = createAdminClient()
  const ts = admin.schema("timesheets")

  const { data: supervisor } = await ts.from("supervisors").select("id").eq("user_id", user.id).single()
  if (!supervisor) return NextResponse.json({ error: "Supervisor record not found" }, { status: 404 })

  const { data: timesheet } = await ts.from("timesheets").select("id, supervisor_id, status").eq("id", id).single()
  if (!timesheet || timesheet.supervisor_id !== supervisor.id) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (timesheet.status !== "submitted") return NextResponse.json({ error: "Only submitted timesheets can be approved" }, { status: 400 })

  const { data: updated, error } = await ts
    .from("timesheets")
    .update({ status: "approved", approved_at: new Date().toISOString(), approved_by: supervisor.id })
    .eq("id", id)
    .select("*")
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await ts.from("timesheet_events").insert({ timesheet_id: id, event_type: "approved", actor_user_id: user.id })

  const { data: contractor } = await ts.from("contractors").select("email").eq("id", updated.contractor_id).single()
  if (contractor) {
    sendTimesheetApprovedEmail({
      timesheetId: id,
      weekStarting: updated.week_starting,
      contractorEmail: contractor.email,
    }).catch((err) => console.error("[email] timesheet-approved notification failed", err))
  }

  return NextResponse.json(updated)
}
