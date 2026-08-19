import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isEmailPaused, isExternalEmailPaused } from "@/lib/email/pause"
import { sendApplicationUnsuccessfulEmail } from "@/lib/email/notifications/recruitment-candidates"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Skip the whole run if paused — leaves every 'pending' row untouched for
  // tomorrow, since paused is a temporary/intentional condition, not a
  // delivery error, and the query below only ever picks up 'pending' rows.
  if (await isEmailPaused()) return NextResponse.json({ skipped: "paused" })
  if (await isExternalEmailPaused()) return NextResponse.json({ skipped: "external_paused" })

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recruitment = admin.schema("recruitment") as any

  const today = new Date().toISOString().slice(0, 10)
  const { data: due, error } = await recruitment
    .from("scheduled_emails")
    .select("id, job_id, application_id, candidate_id")
    .eq("status", "pending")
    .lte("scheduled_for", today)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let sent = 0, cancelled = 0, failed = 0

  for (const row of due ?? []) {
    // Re-check the application's current stage — it may have moved to
    // 'placed'/'withdrawn' after being scheduled but before this send date
    // (e.g. a second vacancy on the same job placed this candidate later).
    // Sending an "unsuccessful" email to a now-placed candidate would be a
    // real, visible mistake.
    const { data: app } = await recruitment.from("applications").select("stage").eq("id", row.application_id).single()
    if (!app || app.stage === "placed" || app.stage === "withdrawn") {
      await recruitment.from("scheduled_emails")
        .update({ status: "cancelled", error_message: "Application stage changed before send" })
        .eq("id", row.id)
      cancelled++
      continue
    }

    const { data: candidate } = await recruitment
      .from("candidates")
      .select("first_name, last_name, email, is_active")
      .eq("id", row.candidate_id)
      .single()

    if (!candidate || !candidate.is_active) {
      await recruitment.from("scheduled_emails")
        .update({ status: "failed", error_message: "Candidate inactive or not found" })
        .eq("id", row.id)
      failed++
      continue
    }

    const { data: job } = await recruitment.from("jobs").select("title, company_id").eq("id", row.job_id).single()
    const { data: company } = job
      ? await admin.from("companies").select("name").eq("id", job.company_id).single()
      : { data: null }

    const ok = await sendApplicationUnsuccessfulEmail({
      candidateEmail: candidate.email,
      candidateName: `${candidate.first_name} ${candidate.last_name}`,
      jobTitle: job?.title ?? "the role",
      companyName: company?.name ?? "the company",
    })

    await recruitment.from("scheduled_emails")
      .update(ok
        ? { status: "sent", sent_at: new Date().toISOString() }
        : { status: "failed", error_message: "Send failed — see server logs" })
      .eq("id", row.id)

    if (ok) sent++
    else failed++
  }

  return NextResponse.json({ checked: due?.length ?? 0, sent, cancelled, failed })
}
