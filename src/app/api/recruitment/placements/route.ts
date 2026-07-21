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

  const { data: placement, error } = await recruitment
    .from("placements")
    .insert({
      ...parsed.data,
      status: "confirmed",
      confirmed_by: user.id,
      confirmed_at: new Date().toISOString(),
    })
    .select("id, job_id, candidate_id, start_date")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const [{ data: job }, { data: candidate }] = await Promise.all([
    recruitment.from("jobs").select("title, assigned_recruiter_id").eq("id", placement.job_id).single(),
    recruitment.from("candidates").select("first_name, last_name").eq("id", placement.candidate_id).single(),
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

  return NextResponse.json(placement, { status: 201 })
}
