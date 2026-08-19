import { sendTemplatedEmail } from "../send-templated"

// Candidates have no Supabase auth account — email is read directly off
// candidates.email (denormalized), same pattern as notifications/timesheets.ts's
// contractor/supervisor recipients, no admin.getUserById lookup needed.

// Returns boolean (unlike the void-returning siblings in notifications.ts)
// because the scheduled-emails cron records per-row sent/failed status into
// recruitment.scheduled_emails.
export async function sendApplicationUnsuccessfulEmail(params: {
  candidateEmail: string
  candidateName: string
  jobTitle: string
  companyName: string
}): Promise<boolean> {
  return sendTemplatedEmail(
    "application_unsuccessful",
    {
      candidateName: params.candidateName,
      jobTitle: params.jobTitle,
      companyName: params.companyName,
    },
    { to: params.candidateEmail, external: true }
  )
}
