import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendContractExpiringEmail } from "@/lib/email/notifications"
import { isExactlyDaysAway } from "@/lib/date-helpers"

export const dynamic = "force-dynamic"

const REMINDER_DAYS = [30, 14, 7]

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recruitment = admin.schema("recruitment") as any

  const { data: contracts, error } = await recruitment
    .from("placements")
    .select("id, job_id, candidate_id, finish_date")
    .eq("placement_type", "contract")
    .in("status", ["confirmed", "started"])
    .not("finish_date", "is", null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const matching = (contracts ?? []).filter((p: { finish_date: string }) =>
    REMINDER_DAYS.some((days) => isExactlyDaysAway(p.finish_date, days))
  )

  let sent = 0
  for (const placement of matching) {
    const [{ data: job }, { data: candidate }] = await Promise.all([
      recruitment.from("jobs").select("title, assigned_recruiter_id").eq("id", placement.job_id).single(),
      recruitment.from("candidates").select("first_name, last_name").eq("id", placement.candidate_id).single(),
    ])

    if (!job?.assigned_recruiter_id) continue

    await sendContractExpiringEmail({
      jobId: placement.job_id,
      jobTitle: job.title,
      candidateName: candidate ? `${candidate.first_name} ${candidate.last_name}` : "Candidate",
      finishDate: placement.finish_date,
      recipientUserId: job.assigned_recruiter_id,
    }).catch((err) => console.error("[cron/contract-expiry-check] send failed", err))
    sent++
  }

  return NextResponse.json({ checked: contracts?.length ?? 0, matched: matching.length, sent })
}
