import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendDueDateReminderEmail } from "@/lib/email/notifications"
import { isExactlyDaysAway } from "@/lib/date-helpers"

export const dynamic = "force-dynamic"

const REMINDER_DAYS = [7, 3, 1]

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = createAdminClient()

  const { data: dueSoon, error } = await admin
    .schema("regulatory")
    .from("consultations")
    .select("id, title, due_date")
    .not("due_date", "is", null)
    .in("status", ["draft", "in_progress", "under_review"])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const matching = (dueSoon ?? []).filter((c) =>
    REMINDER_DAYS.some((days) => isExactlyDaysAway(c.due_date!, days))
  )

  let sent = 0
  for (const consultation of matching) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: consultants } = await (admin.schema("regulatory") as any)
      .from("consultation_consultants")
      .select("consultant_id")
      .eq("consultation_id", consultation.id)

    for (const c of (consultants ?? []) as { consultant_id: string }[]) {
      await sendDueDateReminderEmail({
        consultationId: consultation.id,
        consultationTitle: consultation.title,
        dueDate: consultation.due_date!,
        recipientUserId: c.consultant_id,
      }).catch((err) => console.error("[cron/due-date-check] send failed", err))
      sent++
    }
  }

  return NextResponse.json({ checked: dueSoon?.length ?? 0, matched: matching.length, sent })
}
