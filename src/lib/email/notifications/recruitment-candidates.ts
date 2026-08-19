import { createResendClient, EMAIL_FROM } from "../client"
import { isEmailPaused, isExternalEmailPaused } from "../pause"
import { render } from "@react-email/components"
import { ApplicationUnsuccessfulEmail } from "../templates/ApplicationUnsuccessful"

// Candidates have no Supabase auth account — email is read directly off
// candidates.email (denormalized), same pattern as notifications/timesheets.ts's
// contractor/supervisor recipients, no admin.getUserById lookup needed.

async function send(to: string, subject: string, html: string): Promise<boolean> {
  if (await isEmailPaused()) {
    console.log("[email] paused — skipped", { to, subject })
    return false
  }
  if (await isExternalEmailPaused()) {
    console.log("[email] external paused — skipped", { to, subject })
    return false
  }
  try {
    const resend = createResendClient()
    await resend.emails.send({ from: EMAIL_FROM, to, subject, html })
    return true
  } catch (err) {
    console.error("[email] send failed", { to, subject, err })
    return false
  }
}

// Returns boolean (unlike the void-returning siblings in notifications.ts)
// because the scheduled-emails cron records per-row sent/failed status into
// recruitment.scheduled_emails.
export async function sendApplicationUnsuccessfulEmail(params: {
  candidateEmail: string
  candidateName: string
  jobTitle: string
  companyName: string
}): Promise<boolean> {
  const html = await render(
    ApplicationUnsuccessfulEmail({
      candidateName: params.candidateName,
      jobTitle: params.jobTitle,
      companyName: params.companyName,
    })
  )
  return send(params.candidateEmail, `Update on your application: ${params.jobTitle}`, html)
}
