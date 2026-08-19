import { createResendClient, EMAIL_FROM } from "../client"
import { isEmailPaused, isExternalEmailPaused } from "../pause"
import { render } from "@react-email/components"
import { TimesheetSubmittedEmail } from "../templates/TimesheetSubmitted"
import { TimesheetDeclinedEmail } from "../templates/TimesheetDeclined"
import { TimesheetApprovedEmail } from "../templates/TimesheetApproved"

// Split out from ../notifications.ts per its own guidance: that file's
// existing 7 functions cover consultations/recruitment; a 4th domain
// (timesheets) is the trigger to split rather than keep growing one file.
// Recipients are contractors/supervisors, whose email is already denormalized
// on timesheets.contractors/timesheets.supervisors (no admin.getUserById
// round trip needed, unlike the internal-staff notifications).

const TIMESHEETS_PORTAL_ORIGIN = process.env.TIMESHEETS_PORTAL_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? ""

async function send(to: string, subject: string, html: string) {
  if (await isEmailPaused()) {
    console.log("[email] paused — skipped", { to, subject })
    return
  }
  if (await isExternalEmailPaused()) {
    console.log("[email] external paused — skipped", { to, subject })
    return
  }
  try {
    const resend = createResendClient()
    await resend.emails.send({ from: EMAIL_FROM, to, subject, html })
  } catch (err) {
    console.error("[email] send failed", { to, subject, err })
  }
}

export async function sendTimesheetSubmittedEmail(params: {
  timesheetId: string
  contractorName: string
  weekStarting: string
  supervisorEmail: string
}) {
  const html = await render(
    TimesheetSubmittedEmail({
      contractorName: params.contractorName,
      weekStarting: params.weekStarting,
      approvalUrl: `${TIMESHEETS_PORTAL_ORIGIN}/approvals/${params.timesheetId}`,
    })
  )
  await send(params.supervisorEmail, `${params.contractorName} submitted a timesheet for approval`, html)
}

export async function sendTimesheetDeclinedEmail(params: {
  timesheetId: string
  weekStarting: string
  reason: string
  contractorEmail: string
}) {
  const html = await render(
    TimesheetDeclinedEmail({
      weekStarting: params.weekStarting,
      reason: params.reason,
      timesheetUrl: `${TIMESHEETS_PORTAL_ORIGIN}/my-timesheets/${params.timesheetId}`,
    })
  )
  await send(params.contractorEmail, `Timesheet declined: week of ${params.weekStarting}`, html)
}

export async function sendTimesheetApprovedEmail(params: {
  timesheetId: string
  weekStarting: string
  contractorEmail: string
}) {
  const html = await render(
    TimesheetApprovedEmail({
      weekStarting: params.weekStarting,
      timesheetUrl: `${TIMESHEETS_PORTAL_ORIGIN}/my-timesheets/${params.timesheetId}`,
    })
  )
  await send(params.contractorEmail, `Timesheet approved: week of ${params.weekStarting}`, html)
}
