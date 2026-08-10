import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requirePermissionOrSuperAdmin } from "@/lib/auth-helpers"
import { z } from "zod"
import type { JobStatus } from "@/types/database"
import { sendJobDetailsChangedEmail } from "@/lib/email/notifications"

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  requirements: z.string().optional(),
  employment_type: z.enum(["permanent", "contract", "casual", "full_time", "part_time"]).optional(),
  vacancies_count: z.number().int().min(1).optional(),
  location: z.string().optional(),
  salary_min: z.number().positive().optional().nullable(),
  salary_max: z.number().positive().optional().nullable(),
  contract_duration_weeks: z.number().int().positive().optional().nullable(),
  security_clearance_required: z.boolean().optional(),
  security_clearance_level_required: z.string().optional().nullable(),
  right_to_work_check_required: z.boolean().optional(),
  right_to_work_notes: z.string().optional().nullable(),
  assigned_recruiter_id: z.string().uuid().optional().nullable(),
  status: z.enum(["opened", "posted", "active", "paused", "filled", "closed"]).optional(),
  reference_number: z.string().min(1).max(100).optional(),
  required_skills: z.array(z.string()).optional(),
  required_education_tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
})

// GET /api/recruitment/jobs/[jobId]
export async function GET(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { jobId } = await params
  const admin = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: job, error } = await (admin.schema("recruitment") as any)
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .single()

  if (error || !job) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const [{ data: company }, { data: recruiter }, { data: events }, { count: placedCount }] = await Promise.all([
    admin.from("companies").select("id, name").eq("id", job.company_id).single(),
    job.assigned_recruiter_id
      ? admin.from("profiles").select("id, full_name").eq("id", job.assigned_recruiter_id).single()
      : Promise.resolve({ data: null }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin.schema("recruitment") as any)
      .from("job_events")
      .select("id, event_type, previous_status, new_status, notes, created_at, performed_by")
      .eq("job_id", jobId)
      .order("created_at", { ascending: true }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin.schema("recruitment") as any)
      .from("placements")
      .select("id", { count: "exact", head: true })
      .eq("job_id", jobId),
  ])

  // Hydrate event performer names
  const performerIds = [...new Set((events ?? []).map((e: { performed_by: string }) => e.performed_by))]
  const { data: performers } = performerIds.length
    ? await admin.from("profiles").select("id, full_name").in("id", performerIds as string[])
    : { data: [] }
  const perfMap = Object.fromEntries((performers ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name]))

  return NextResponse.json({
    ...job,
    company_name: company?.name ?? null,
    recruiter_name: recruiter?.full_name ?? null,
    placed_count: placedCount ?? 0,
    events: (events ?? []).map((e: Record<string, unknown>) => ({
      ...e,
      performer_name: perfMap[e.performed_by as string] ?? null,
    })),
  })
}

// PATCH /api/recruitment/jobs/[jobId]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { jobId } = await params
  const body = await req.json()
  const { notes: eventNotes, ...rest } = body
  // A note-only patch (just a timeline comment) is a low-risk collaborative
  // action available to any recruitment member; changing actual job fields
  // requires the elevated edit permission.
  const isNoteOnly = Object.keys(rest).length === 0
  const requiredPermission = isNoteOnly ? "recruitment.access" : "recruitment.jobs.edit"
  if (!(await requirePermissionOrSuperAdmin(supabase, user.id, requiredPermission))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const parsed = patchSchema.safeParse({ ...rest, notes: eventNotes })
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: current } = await (admin.schema("recruitment") as any)
    .from("jobs")
    .select("title, status, employment_type, assigned_recruiter_id")
    .eq("id", jobId)
    .single()
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { notes: _, ...updateFields } = parsed.data

  // A note-only patch has nothing to set on the jobs row itself — skip the
  // update (an empty .update({}) would error) and fall straight through to
  // the job_events insert below.
  let updated: { id: string; title: string; status: string; updated_at: string }
  if (Object.keys(updateFields).length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (admin.schema("recruitment") as any)
      .from("jobs")
      .update(updateFields)
      .eq("id", jobId)
      .select("id, title, status, updated_at")
      .single()

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "That reference number is already in use by another job" }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    updated = data
  } else {
    updated = { id: jobId, title: current.title, status: current.status, updated_at: new Date().toISOString() }
  }

  // Log status change event if status changed
  if (parsed.data.status && parsed.data.status !== current.status) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin.schema("recruitment") as any)
      .from("job_events")
      .insert({
        job_id: jobId,
        event_type: parsed.data.status as JobStatus,
        previous_status: current.status,
        new_status: parsed.data.status,
        notes: eventNotes ?? null,
        performed_by: user.id,
      })

    if (current.assigned_recruiter_id) {
      sendJobDetailsChangedEmail({
        jobId,
        jobTitle: current.title,
        field: "status",
        oldValue: current.status,
        newValue: parsed.data.status,
        recipientUserId: current.assigned_recruiter_id,
      }).catch((err) => console.error("[email] job status-changed notification failed", err))
    }
  } else if (eventNotes) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin.schema("recruitment") as any)
      .from("job_events")
      .insert({
        job_id: jobId,
        event_type: "note",
        notes: eventNotes,
        performed_by: user.id,
      })
  }

  // Log + notify employment_type change (no dedicated job_events enum value — logged as a note)
  if (parsed.data.employment_type && parsed.data.employment_type !== current.employment_type) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin.schema("recruitment") as any)
      .from("job_events")
      .insert({
        job_id: jobId,
        event_type: "note",
        notes: `Employment type changed from ${current.employment_type} to ${parsed.data.employment_type}`,
        performed_by: user.id,
      })

    if (current.assigned_recruiter_id) {
      sendJobDetailsChangedEmail({
        jobId,
        jobTitle: current.title,
        field: "employment_type",
        oldValue: String(current.employment_type),
        newValue: parsed.data.employment_type,
        recipientUserId: current.assigned_recruiter_id,
      }).catch((err) => console.error("[email] job employment_type-changed notification failed", err))
    }
  }

  return NextResponse.json(updated)
}
