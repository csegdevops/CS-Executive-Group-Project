import { NextRequest, NextResponse } from "next/server"
import { requireContractorAuth } from "@/lib/auth-helpers"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendTimesheetSubmittedEmail } from "@/lib/email/notifications/timesheets"

// POST /api/timesheets-portal/timesheets/[id]/submit — draft -> submitted, or
// declined -> submitted (a "resubmit", logged distinctly from the initial
// submission). Resolves the current supervisor from the active
// supervisor_assignments row at submit time.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireContractorAuth()
  const { id } = await params

  const admin = createAdminClient()
  const ts = admin.schema("timesheets")

  const { data: contractor } = await ts.from("contractors").select("id, full_name").eq("user_id", user.id).single()
  if (!contractor) return NextResponse.json({ error: "Contractor record not found" }, { status: 404 })

  const { data: timesheet } = await ts.from("timesheets").select("id, contractor_id, status, is_template").eq("id", id).single()
  if (!timesheet || timesheet.contractor_id !== contractor.id) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (timesheet.is_template) return NextResponse.json({ error: "Templates cannot be submitted" }, { status: 400 })
  if (!["draft", "declined"].includes(timesheet.status)) {
    return NextResponse.json({ error: "This timesheet has already been submitted" }, { status: 400 })
  }

  const { count: entryCount } = await ts.from("timesheet_entries").select("id", { count: "exact", head: true }).eq("timesheet_id", id)
  if (!entryCount) return NextResponse.json({ error: "Add at least one entry before submitting" }, { status: 400 })

  const { data: assignment } = await ts
    .from("supervisor_assignments")
    .select("supervisor_id")
    .eq("contractor_id", contractor.id)
    .is("end_date", null)
    .maybeSingle()
  if (!assignment) return NextResponse.json({ error: "No supervisor is currently assigned — contact your account manager" }, { status: 400 })

  const wasDeclined = timesheet.status === "declined"

  const { data: updated, error } = await ts
    .from("timesheets")
    .update({
      status: "submitted",
      supervisor_id: assignment.supervisor_id,
      submitted_at: new Date().toISOString(),
      decline_reason: null,
      declined_at: null,
      declined_by: null,
    })
    .eq("id", id)
    .select("*")
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await ts.from("timesheet_events").insert({
    timesheet_id: id,
    event_type: wasDeclined ? "resubmitted" : "submitted",
    actor_user_id: user.id,
  })

  const { data: supervisor } = await ts.from("supervisors").select("email").eq("id", assignment.supervisor_id).single()
  if (supervisor) {
    sendTimesheetSubmittedEmail({
      timesheetId: id,
      contractorName: contractor.full_name,
      weekStarting: updated.week_starting,
      supervisorEmail: supervisor.email,
    }).catch((err) => console.error("[email] timesheet-submitted notification failed", err))
  }

  return NextResponse.json(updated)
}
