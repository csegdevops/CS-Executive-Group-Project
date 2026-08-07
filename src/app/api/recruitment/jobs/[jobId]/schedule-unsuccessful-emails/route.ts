import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requirePermissionOrSuperAdmin } from "@/lib/auth-helpers"
import { z } from "zod"

const scheduleSchema = z.object({
  application_ids: z.array(z.string().uuid()).min(1),
  scheduled_for: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  task_id: z.string().uuid(),
})

// POST /api/recruitment/jobs/[jobId]/schedule-unsuccessful-emails
// Never sends anything itself — just queues rows for the daily cron
// (send-scheduled-application-emails) to pick up on/after scheduled_for.
export async function POST(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await requirePermissionOrSuperAdmin(supabase, user.id, "recruitment.tasks.edit"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { jobId } = await params
  const body = await req.json()
  const parsed = scheduleSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recruitment = admin.schema("recruitment") as any

  const { data: task } = await recruitment.from("tasks").select("id, task_type, job_id").eq("id", parsed.data.task_id).single()
  if (!task || task.task_type !== "general" || task.job_id !== jobId) {
    return NextResponse.json({ error: "Task does not match this job" }, { status: 400 })
  }

  // Defend against a stale client-side list: only applications that still
  // belong to this job and are still in play.
  const { data: apps } = await recruitment
    .from("applications")
    .select("id, candidate_id")
    .eq("job_id", jobId)
    .in("id", parsed.data.application_ids)
    .not("stage", "in", "(placed,withdrawn)")

  const validAppIds = (apps ?? []).map((a: { id: string }) => a.id)
  if (validAppIds.length === 0) {
    return NextResponse.json({ scheduled: 0, skipped: parsed.data.application_ids.length }, { status: 200 })
  }

  const { data: existing } = await recruitment
    .from("scheduled_emails")
    .select("application_id")
    .eq("status", "pending")
    .in("application_id", validAppIds)

  const alreadyScheduled = new Set((existing ?? []).map((e: { application_id: string }) => e.application_id))
  const toInsert = (apps ?? []).filter((a: { id: string }) => !alreadyScheduled.has(a.id))

  if (toInsert.length > 0) {
    const { error } = await recruitment.from("scheduled_emails").insert(
      toInsert.map((a: { id: string; candidate_id: string }) => ({
        job_id: jobId,
        application_id: a.id,
        candidate_id: a.candidate_id,
        task_id: parsed.data.task_id,
        scheduled_for: parsed.data.scheduled_for,
        created_by: user.id,
      }))
    )
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await recruitment
    .from("tasks")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", parsed.data.task_id)
    .neq("status", "completed")

  return NextResponse.json({
    scheduled: toInsert.length,
    skipped: parsed.data.application_ids.length - toInsert.length,
  }, { status: 201 })
}
