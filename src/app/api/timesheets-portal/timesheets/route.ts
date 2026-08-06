import { NextRequest, NextResponse } from "next/server"
import { requireContractorAuth } from "@/lib/auth-helpers"
import { createAdminClient } from "@/lib/supabase/admin"
import { z } from "zod"

const createSchema = z.object({
  week_starting:    z.string().min(1),
  from_template_id: z.string().uuid().optional().nullable(),
  is_template:       z.boolean().default(false),
})

// GET /api/timesheets-portal/timesheets — the signed-in contractor's own
// timesheets (real weeks + saved templates).
export async function GET() {
  const user = await requireContractorAuth()
  const admin = createAdminClient()
  const ts = admin.schema("timesheets")

  const { data: contractor } = await ts.from("contractors").select("id").eq("user_id", user.id).single()
  if (!contractor) return NextResponse.json({ error: "Contractor record not found" }, { status: 404 })

  const { data: timesheets, error } = await ts
    .from("timesheets")
    .select("id, week_starting, status, decline_reason, is_template, submitted_at, approved_at, declined_at")
    .eq("contractor_id", contractor.id)
    .order("week_starting", { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(timesheets ?? [])
}

// POST /api/timesheets-portal/timesheets — create a draft for a week
// (optionally seeded from a saved template's entries) or save a new template.
export async function POST(req: NextRequest) {
  const user = await requireContractorAuth()
  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const input = parsed.data

  const admin = createAdminClient()
  const ts = admin.schema("timesheets")

  const { data: contractor } = await ts.from("contractors").select("id").eq("user_id", user.id).single()
  if (!contractor) return NextResponse.json({ error: "Contractor record not found" }, { status: 404 })

  const { data: timesheet, error } = await ts
    .from("timesheets")
    .insert({
      contractor_id: contractor.id,
      week_starting: input.week_starting,
      is_template: input.is_template,
    })
    .select("*")
    .single()
  if (error) {
    const message = error.code === "23505" ? "A timesheet for this week already exists" : error.message
    return NextResponse.json({ error: message }, { status: error.code === "23505" ? 409 : 500 })
  }

  if (input.from_template_id) {
    const { data: templateEntries } = await ts
      .from("timesheet_entries")
      .select("work_date, hours, description")
      .eq("timesheet_id", input.from_template_id)

    if (templateEntries?.length) {
      const weekStart = new Date(input.week_starting)
      const templateStart = new Date(templateEntries[0].work_date)
      const rows = templateEntries.map((e) => {
        const offsetDays = Math.round((new Date(e.work_date).getTime() - templateStart.getTime()) / 86400000)
        const workDate = new Date(weekStart)
        workDate.setDate(workDate.getDate() + offsetDays)
        return {
          timesheet_id: timesheet.id,
          work_date: workDate.toISOString().slice(0, 10),
          hours: e.hours,
          description: e.description,
        }
      })
      await ts.from("timesheet_entries").insert(rows)
    }
  }

  return NextResponse.json(timesheet, { status: 201 })
}
