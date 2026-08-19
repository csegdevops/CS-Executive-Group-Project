import { sendTemplatedEmail } from "../send-templated"

// Split out from ../notifications.ts per its own guidance: that file's
// existing 7 functions cover consultations/recruitment; a 4th domain
// (timesheets) is the trigger to split rather than keep growing one file.
// Recipients are contractors/supervisors, whose email is already denormalized
// on timesheets.contractors/timesheets.supervisors (no admin.getUserById
// round trip needed, unlike the internal-staff notifications).

const TIMESHEETS_PORTAL_ORIGIN = process.env.TIMESHEETS_PORTAL_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? ""

export async function sendTimesheetSubmittedEmail(params: {
  timesheetId: string
  contractorName: string
  weekStarting: string
  supervisorEmail: string
}) {
  await sendTemplatedEmail(
    "timesheet_submitted",
    {
      contractorName: params.contractorName,
      weekStarting: params.weekStarting,
      approvalUrl: `${TIMESHEETS_PORTAL_ORIGIN}/approvals/${params.timesheetId}`,
    },
    { to: params.supervisorEmail, external: true }
  )
}

export async function sendTimesheetDeclinedEmail(params: {
  timesheetId: string
  weekStarting: string
  reason: string
  contractorEmail: string
}) {
  await sendTemplatedEmail(
    "timesheet_declined",
    {
      weekStarting: params.weekStarting,
      reason: params.reason,
      timesheetUrl: `${TIMESHEETS_PORTAL_ORIGIN}/my-timesheets/${params.timesheetId}`,
    },
    { to: params.contractorEmail, external: true }
  )
}

export async function sendTimesheetApprovedEmail(params: {
  timesheetId: string
  weekStarting: string
  contractorEmail: string
}) {
  await sendTemplatedEmail(
    "timesheet_approved",
    {
      weekStarting: params.weekStarting,
      timesheetUrl: `${TIMESHEETS_PORTAL_ORIGIN}/my-timesheets/${params.timesheetId}`,
    },
    { to: params.contractorEmail, external: true }
  )
}
