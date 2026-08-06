import { NextRequest, NextResponse } from "next/server"
import { requireSupervisorAuth } from "@/lib/auth-helpers"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendTimesheetDeclinedEmail } from "@/lib/email/notifications/timesheets"
import { z } from "zod"

const declineSchema = z.object({ reason: z.string().min(1) })

// POST /api/timesheets-portal/timesheets/[id]/decline — declining requires a
// typed reason; the contractor can then amend entries and resubmit.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireSupervisorAuth()
  const { id } = await params
  const body = await req.json()
  const parsed = declineSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const admin = createAdminClient()
  const ts = admin.schema("timesheets")

  const { data: supervisor } = await ts.from("supervisors").select("id").eq("user_id", user.id).single()
  if (!supervisor) return NextResponse.json({ error: "Supervisor record not found" }, { status: 404 })

  const { data: timesheet } = await ts.from("timesheets").select("id, supervisor_id, status").eq("id", id).single()
  if (!timesheet || timesheet.supervisor_id !== supervisor.id) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (timesheet.status !== "submitted") return NextResponse.json({ error: "Only submitted timesheets can be declined" }, { status: 400 })

  const { data: updated, error } = await ts
    .from("timesheets")
    .update({
      status: "declined",
      decline_reason: parsed.data.reason,
      declined_at: new Date().toISOString(),
      declined_by: supervisor.id,
    })
    .eq("id", id)
    .select("*")
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await ts.from("timesheet_events").insert({ timesheet_id: id, event_type: "declined", actor_user_id: user.id, notes: parsed.data.reason })

  const { data: contractor } = await ts.from("contractors").select("email").eq("id", updated.contractor_id).single()
  if (contractor) {
    sendTimesheetDeclinedEmail({
      timesheetId: id,
      weekStarting: updated.week_starting,
      reason: parsed.data.reason,
      contractorEmail: contractor.email,
    }).catch((err) => console.error("[email] timesheet-declined notification failed", err))
  }

  return NextResponse.json(updated)
}
