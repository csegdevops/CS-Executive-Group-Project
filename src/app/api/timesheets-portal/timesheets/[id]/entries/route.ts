import { NextRequest, NextResponse } from "next/server"
import { requireContractorAuth } from "@/lib/auth-helpers"
import { createAdminClient } from "@/lib/supabase/admin"
import { z } from "zod"

const entrySchema = z.object({
  work_date:   z.string().min(1),
  hours:       z.coerce.number().min(0).max(24),
  description: z.string().optional().nullable(),
})
const patchSchema = z.object({ entries: z.array(entrySchema) })

// PATCH /api/timesheets-portal/timesheets/[id]/entries — replaces the full
// entry set for a timesheet (small weekly grid — simplest correct approach).
// Only the owning contractor may edit, and only while draft or declined
// (declined -> editing here is the "amend" step, ahead of resubmission).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireContractorAuth()
  const { id } = await params
  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const admin = createAdminClient()
  const ts = admin.schema("timesheets")

  const { data: contractor } = await ts.from("contractors").select("id").eq("user_id", user.id).single()
  if (!contractor) return NextResponse.json({ error: "Contractor record not found" }, { status: 404 })

  const { data: timesheet } = await ts.from("timesheets").select("id, contractor_id, status").eq("id", id).single()
  if (!timesheet || timesheet.contractor_id !== contractor.id) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!["draft", "declined"].includes(timesheet.status)) {
    return NextResponse.json({ error: "This timesheet can no longer be edited" }, { status: 400 })
  }

  await ts.from("timesheet_entries").delete().eq("timesheet_id", id)
  if (parsed.data.entries.length > 0) {
    const { error } = await ts.from("timesheet_entries").insert(
      parsed.data.entries.map((e) => ({ ...e, timesheet_id: id }))
    )
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (timesheet.status === "declined") {
    await ts.from("timesheet_events").insert({ timesheet_id: id, event_type: "amended", actor_user_id: user.id })
  }

  return NextResponse.json({ ok: true })
}
