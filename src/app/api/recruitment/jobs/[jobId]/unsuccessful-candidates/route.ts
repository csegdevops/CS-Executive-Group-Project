import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requirePermissionOrSuperAdmin } from "@/lib/auth-helpers"

// GET /api/recruitment/jobs/[jobId]/unsuccessful-candidates
// Applicants still "in play" (not placed, not withdrawn) for a filled job —
// the candidate pool a recruiter picks from when scheduling the standard
// "unsuccessful" notification. Already-scheduled applicants are included
// (not hidden) so the recruiter can see and cancel a wrong schedule.
export async function GET(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await requirePermissionOrSuperAdmin(supabase, user.id, "recruitment.tasks.edit"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { jobId } = await params
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recruitment = admin.schema("recruitment") as any

  const { data: job } = await recruitment.from("jobs").select("title").eq("id", jobId).single()
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 })

  const { data: apps, error } = await recruitment
    .from("applications")
    .select("id, candidate_id, stage")
    .eq("job_id", jobId)
    .not("stage", "in", "(placed,withdrawn)")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const candIds = [...new Set((apps ?? []).map((a: { candidate_id: string }) => a.candidate_id))]
  const appIds  = (apps ?? []).map((a: { id: string }) => a.id)

  const [{ data: candidates }, { data: scheduled }] = await Promise.all([
    candIds.length
      ? recruitment.from("candidates").select("id, first_name, last_name, email").in("id", candIds)
      : Promise.resolve({ data: [] }),
    appIds.length
      ? recruitment.from("scheduled_emails").select("application_id, scheduled_for").eq("status", "pending").in("application_id", appIds)
      : Promise.resolve({ data: [] }),
  ])

  const candMap = Object.fromEntries((candidates ?? []).map((c: Record<string, unknown>) => [c.id, c]))
  const scheduledMap = Object.fromEntries(
    (scheduled ?? []).map((s: { application_id: string; scheduled_for: string }) => [s.application_id, s.scheduled_for])
  )

  const result = (apps ?? []).map((a: { id: string; candidate_id: string; stage: string }) => {
    const cand = candMap[a.candidate_id] as Record<string, unknown> | undefined
    return {
      application_id: a.id,
      candidate_id: a.candidate_id,
      candidate_name: cand ? `${cand.first_name} ${cand.last_name}` : "Unknown",
      candidate_email: cand?.email ?? null,
      stage: a.stage,
      already_scheduled: a.id in scheduledMap,
      scheduled_for: scheduledMap[a.id] ?? null,
    }
  })

  return NextResponse.json({ job_id: jobId, job_title: job.title, candidates: result })
}
