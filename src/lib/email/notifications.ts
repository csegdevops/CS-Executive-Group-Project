import { createAdminClient } from "@/lib/supabase/admin"
import { sendTemplatedEmail } from "./send-templated"

async function getEmailForUser(userId: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.getUserById(userId)
  if (error || !data.user?.email) return null
  return data.user.email
}

export async function sendConsultationStatusChangedEmail(params: {
  consultationId: string
  consultationTitle: string
  oldStatus: string
  newStatus: string
  recipientUserId: string
}) {
  const email = await getEmailForUser(params.recipientUserId)
  if (!email) return

  await sendTemplatedEmail(
    "consultation_status_changed",
    {
      consultationTitle: params.consultationTitle,
      oldStatus: params.oldStatus,
      newStatus: params.newStatus,
      consultationUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/regulatory/consultations/${params.consultationId}`,
    },
    { to: email }
  )
}

export async function sendConsultantAssignedEmail(params: {
  consultationId: string
  consultationTitle: string
  companyName: string
  recipientUserId: string
}) {
  const email = await getEmailForUser(params.recipientUserId)
  if (!email) return

  await sendTemplatedEmail(
    "consultant_assigned",
    {
      consultationTitle: params.consultationTitle,
      companyName: params.companyName,
      consultationUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/regulatory/consultations/${params.consultationId}`,
    },
    { to: email }
  )
}

export async function sendDueDateReminderEmail(params: {
  consultationId: string
  consultationTitle: string
  dueDate: string
  recipientUserId: string
}) {
  const email = await getEmailForUser(params.recipientUserId)
  if (!email) return

  await sendTemplatedEmail(
    "due_date_reminder",
    {
      consultationTitle: params.consultationTitle,
      dueDate: params.dueDate,
      consultationUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/regulatory/consultations/${params.consultationId}`,
    },
    { to: email }
  )
}

export async function sendJobDetailsChangedEmail(params: {
  jobId: string
  jobTitle: string
  field: string
  oldValue: string
  newValue: string
  recipientUserId: string
}) {
  const email = await getEmailForUser(params.recipientUserId)
  if (!email) return

  await sendTemplatedEmail(
    "job_details_changed",
    {
      jobTitle: params.jobTitle,
      field: params.field,
      oldValue: params.oldValue,
      newValue: params.newValue,
      jobUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/recruitment/jobs/${params.jobId}`,
    },
    { to: email }
  )
}

export async function sendContractEstablishedEmail(params: {
  jobId: string
  jobTitle: string
  candidateName: string
  startDate: string
  recipientUserId: string
}) {
  const email = await getEmailForUser(params.recipientUserId)
  if (!email) return

  await sendTemplatedEmail(
    "contract_established",
    {
      jobTitle: params.jobTitle,
      candidateName: params.candidateName,
      startDate: params.startDate,
      jobUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/recruitment/jobs/${params.jobId}`,
    },
    { to: email }
  )
}

export async function sendContractExpiringEmail(params: {
  jobId: string
  jobTitle: string
  candidateName: string
  finishDate: string
  recipientUserId: string
}) {
  const email = await getEmailForUser(params.recipientUserId)
  if (!email) return

  await sendTemplatedEmail(
    "contract_expiring",
    {
      jobTitle: params.jobTitle,
      candidateName: params.candidateName,
      finishDate: params.finishDate,
      jobUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/recruitment/jobs/${params.jobId}`,
    },
    { to: email }
  )
}

export async function sendOpportunityStageChangedEmail(params: {
  opportunityId: string
  opportunityTitle: string
  oldStage: string
  newStage: string
  recipientUserId: string
}) {
  const email = await getEmailForUser(params.recipientUserId)
  if (!email) return

  await sendTemplatedEmail(
    "opportunity_stage_changed",
    {
      opportunityTitle: params.opportunityTitle,
      oldStage: params.oldStage,
      newStage: params.newStage,
      opportunityUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/recruitment/pipeline`,
    },
    { to: email }
  )
}
