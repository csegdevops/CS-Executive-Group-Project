import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requirePermissionOrSuperAdmin } from "@/lib/auth-helpers"
import { z } from "zod"
import { sendContractEstablishedEmail } from "@/lib/email/notifications"

const createPlacementSchema = z.object({
  application_id: z.string().uuid(),
  job_id: z.string().uuid(),
  candidate_id: z.string().uuid(),
  placement_type: z.enum(["permanent", "contract"]),
  start_date: z.string(),
  finish_date: z.string().optional().nullable(),
  pay_rate: z.number().positive().optional().nullable(),
  charge_rate: z.number().positive().optional().nullable(),
  currency: z.string().default("AUD"),
  salary_package: z.number().positive().optional().nullable(),
  placement_fee: z.number().positive().optional().nullable(),
  fee_type: z.enum(["percentage", "fixed"]).optional().nullable(),
  fee_percentage: z.number().positive().optional().nullable(),
})

// POST /api/recruitment/placements
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await requirePermissionOrSuperAdmin(supabase, user.id, "recruitment.placements.create"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const parsed = createPlacementSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recruitment = admin.schema("recruitment") as any

  // Placements exist to fill a job's vacancies — never let the count exceed
  // vacancies_count, no matter how the request got here (bulk or single).
  const [{ data: vacancyJob }, { count: existingPlacements }] = await Promise.all([
    recruitment.from("jobs").select("vacancies_count").eq("id", parsed.data.job_id).single(),
    recruitment.from("placements").select("id", { count: "exact", head: true }).eq("job_id", parsed.data.job_id),
  ])
  if (vacancyJob && (existingPlacements ?? 0) >= (vacancyJob.vacancies_count ?? 1)) {
    return NextResponse.json({ error: "This job has no vacancies remaining" }, { status: 409 })
  }

  const { data: placement, error } = await recruitment
    .from("placements")
    .insert({
      ...parsed.data,
      status: "confirmed",
      confirmed_by: user.id,
      confirmed_at: new Date().toISOString(),
    })
    .select("id, job_id, candidate_id, placement_type, start_date, finish_date, pay_rate, charge_rate, currency")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // A placement means the candidate is placed — keep the application in sync
  // (application_stage_history logs this automatically via
  // trg_log_application_stage_change, same as any other stage PATCH).
  await recruitment
    .from("applications")
    .update({ stage: "placed" })
    .eq("id", parsed.data.application_id)
    .neq("stage", "placed")

  const [{ data: job }, { data: candidate }] = await Promise.all([
    recruitment.from("jobs").select("title, status, vacancies_count, assigned_recruiter_id, company_id").eq("id", placement.job_id).single(),
    recruitment.from("candidates").select("first_name, last_name, email").eq("id", placement.candidate_id).single(),
  ])

  if (job?.assigned_recruiter_id) {
    sendContractEstablishedEmail({
      jobId: placement.job_id,
      jobTitle: job.title,
      candidateName: candidate ? `${candidate.first_name} ${candidate.last_name}` : "Candidate",
      startDate: placement.start_date,
      recipientUserId: job.assigned_recruiter_id,
    }).catch((err) => console.error("[email] contract-established notification failed", err))
  }

  // Auto-suggest "filled" once placements reach vacancies_count — status
  // remains fully editable afterward via JobStatusControl/EditJobDialog
  // (a vacancy can be filled externally, or deliberately left open).
  if (job && job.status !== "filled" && job.status !== "closed") {
    const { count: placedCount } = await recruitment
      .from("placements")
      .select("id", { count: "exact", head: true })
      .eq("job_id", placement.job_id)

    if ((placedCount ?? 0) >= job.vacancies_count) {
      await recruitment
        .from("jobs")
        .update({ status: "filled" })
        .eq("id", placement.job_id)

      await recruitment
        .from("job_events")
        .insert({
          job_id: placement.job_id,
          event_type: "filled",
          previous_status: job.status,
          new_status: "filled",
          notes: `Auto-filled — ${placedCount} of ${job.vacancies_count} vacancies placed`,
          performed_by: user.id,
        })

      // Sending "unsuccessful" notices is never automatic — this task is
      // the recruiter's prompt to review the remaining applicants and
      // schedule the notification themselves (see ScheduleUnsuccessfulEmailsDialog).
      await recruitment
        .from("tasks")
        .insert({
          task_type: "general",
          title: `Send unsuccessful-candidate emails — ${job.title}`,
          description: "This job is now filled. Review remaining applicants and schedule the standard 'unsuccessful' notification.",
          job_id: placement.job_id,
          assigned_to: job.assigned_recruiter_id ?? null,
          assigned_by: user.id,
          due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        })
    }
  }

  return NextResponse.json({
    ...placement,
    company_id: job?.company_id ?? null,
    candidate_name: candidate ? `${candidate.first_name} ${candidate.last_name}` : null,
    candidate_email: candidate?.email ?? null,
  }, { status: 201 })
}
