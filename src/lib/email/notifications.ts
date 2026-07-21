import { createResendClient, EMAIL_FROM } from "./client"
import { createAdminClient } from "@/lib/supabase/admin"
import { render } from "@react-email/components"
import { ConsultationStatusChangedEmail } from "./templates/ConsultationStatusChanged"
import { ConsultantAssignedEmail } from "./templates/ConsultantAssigned"
import { DueDateReminderEmail } from "./templates/DueDateReminder"
import { JobDetailsChangedEmail } from "./templates/JobDetailsChanged"
import { ContractEstablishedEmail } from "./templates/ContractEstablished"
import { ContractExpiringEmail } from "./templates/ContractExpiring"
import { OpportunityStageChangedEmail } from "./templates/OpportunityStageChanged"

async function getEmailForUser(userId: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.getUserById(userId)
  if (error || !data.user?.email) return null
  return data.user.email
}

async function send(to: string, subject: string, html: string) {
  try {
    const resend = createResendClient()
    await resend.emails.send({ from: EMAIL_FROM, to, subject, html })
  } catch (err) {
    console.error("[email] send failed", { to, subject, err })
  }
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

  const html = await render(
    ConsultationStatusChangedEmail({
      consultationTitle: params.consultationTitle,
      oldStatus: params.oldStatus,
      newStatus: params.newStatus,
      consultationUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/regulatory/consultations/${params.consultationId}`,
    })
  )

  await send(email, `Consultation status updated: ${params.consultationTitle}`, html)
}

export async function sendConsultantAssignedEmail(params: {
  consultationId: string
  consultationTitle: string
  companyName: string
  recipientUserId: string
}) {
  const email = await getEmailForUser(params.recipientUserId)
  if (!email) return

  const html = await render(
    ConsultantAssignedEmail({
      consultationTitle: params.consultationTitle,
      companyName: params.companyName,
      consultationUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/regulatory/consultations/${params.consultationId}`,
    })
  )

  await send(email, `You've been assigned to ${params.consultationTitle}`, html)
}

export async function sendDueDateReminderEmail(params: {
  consultationId: string
  consultationTitle: string
  dueDate: string
  recipientUserId: string
}) {
  const email = await getEmailForUser(params.recipientUserId)
  if (!email) return

  const html = await render(
    DueDateReminderEmail({
      consultationTitle: params.consultationTitle,
      dueDate: params.dueDate,
      consultationUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/regulatory/consultations/${params.consultationId}`,
    })
  )

  await send(email, `Due soon: ${params.consultationTitle}`, html)
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

  const html = await render(
    JobDetailsChangedEmail({
      jobTitle: params.jobTitle,
      field: params.field,
      oldValue: params.oldValue,
      newValue: params.newValue,
      jobUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/recruitment/jobs/${params.jobId}`,
    })
  )

  await send(email, `${params.jobTitle}: ${params.field} updated`, html)
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

  const html = await render(
    ContractEstablishedEmail({
      jobTitle: params.jobTitle,
      candidateName: params.candidateName,
      startDate: params.startDate,
      jobUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/recruitment/jobs/${params.jobId}`,
    })
  )

  await send(email, `Contract established: ${params.candidateName} for ${params.jobTitle}`, html)
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

  const html = await render(
    ContractExpiringEmail({
      jobTitle: params.jobTitle,
      candidateName: params.candidateName,
      finishDate: params.finishDate,
      jobUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/recruitment/jobs/${params.jobId}`,
    })
  )

  await send(email, `Contract expiring soon: ${params.candidateName} for ${params.jobTitle}`, html)
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

  const html = await render(
    OpportunityStageChangedEmail({
      opportunityTitle: params.opportunityTitle,
      oldStage: params.oldStage,
      newStage: params.newStage,
      opportunityUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/crm/pipeline`,
    })
  )

  await send(email, `${params.opportunityTitle} moved to ${params.newStage}`, html)
}
