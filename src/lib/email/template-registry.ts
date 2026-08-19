/**
 * Static metadata for every row in public.email_templates — the DB only
 * stores subject/body/recipients; everything about *why* a template exists
 * and what {{variables}} it accepts lives here, driving the admin list and
 * editor UI. Keys must match the template_key values seeded in
 * 20260819000004_email_templates.sql and the sendTemplatedEmail() call sites
 * in notifications.ts / notifications/*.ts.
 */

export type EmailTemplateModule = "regulatory" | "recruitment" | "timesheets"

export interface EmailTemplateVariable {
  name: string
  description: string
}

export interface EmailTemplateMeta {
  key: string
  label: string
  module: EmailTemplateModule
  trigger: string
  variables: EmailTemplateVariable[]
  /** Sample values used to render the preview and the "send test email" action. */
  sampleValues: Record<string, string>
}

export const EMAIL_TEMPLATE_REGISTRY: EmailTemplateMeta[] = [
  {
    key: "consultation_status_changed",
    label: "Consultation status changed",
    module: "regulatory",
    trigger: "A consultation's status field is updated",
    variables: [
      { name: "consultationTitle", description: "Consultation title" },
      { name: "oldStatus", description: "Previous status" },
      { name: "newStatus", description: "New status" },
      { name: "consultationUrl", description: "Link to the consultation" },
    ],
    sampleValues: {
      consultationTitle: "Acme Co — REACH review",
      oldStatus: "in_progress",
      newStatus: "under_review",
      consultationUrl: "https://example.com/regulatory/consultations/sample",
    },
  },
  {
    key: "consultant_assigned",
    label: "Consultant assigned",
    module: "regulatory",
    trigger: "A consultant is newly assigned to a consultation",
    variables: [
      { name: "consultationTitle", description: "Consultation title" },
      { name: "companyName", description: "Company name" },
      { name: "consultationUrl", description: "Link to the consultation" },
    ],
    sampleValues: {
      consultationTitle: "Acme Co — REACH review",
      companyName: "Acme Co",
      consultationUrl: "https://example.com/regulatory/consultations/sample",
    },
  },
  {
    key: "due_date_reminder",
    label: "Due date reminder",
    module: "regulatory",
    trigger: "Cron: a consultation's due date is 7/3/1 days away",
    variables: [
      { name: "consultationTitle", description: "Consultation title" },
      { name: "dueDate", description: "Due date" },
      { name: "consultationUrl", description: "Link to the consultation" },
    ],
    sampleValues: {
      consultationTitle: "Acme Co — REACH review",
      dueDate: "2026-09-01",
      consultationUrl: "https://example.com/regulatory/consultations/sample",
    },
  },
  {
    key: "job_details_changed",
    label: "Job details changed",
    module: "recruitment",
    trigger: "A job's status or employment type changes",
    variables: [
      { name: "jobTitle", description: "Job title" },
      { name: "field", description: "Name of the field that changed" },
      { name: "oldValue", description: "Previous value" },
      { name: "newValue", description: "New value" },
      { name: "jobUrl", description: "Link to the job" },
    ],
    sampleValues: {
      jobTitle: "Senior Chemist",
      field: "status",
      oldValue: "active",
      newValue: "filled",
      jobUrl: "https://example.com/recruitment/jobs/sample",
    },
  },
  {
    key: "contract_established",
    label: "Contract established",
    module: "recruitment",
    trigger: "A placement is created for a job",
    variables: [
      { name: "jobTitle", description: "Job title" },
      { name: "candidateName", description: "Candidate name" },
      { name: "startDate", description: "Contract start date" },
      { name: "jobUrl", description: "Link to the job" },
    ],
    sampleValues: {
      jobTitle: "Senior Chemist",
      candidateName: "Jordan Lee",
      startDate: "2026-09-01",
      jobUrl: "https://example.com/recruitment/jobs/sample",
    },
  },
  {
    key: "contract_expiring",
    label: "Contract expiring",
    module: "recruitment",
    trigger: "Cron: a placement's finish date is 30/14/7 days away",
    variables: [
      { name: "jobTitle", description: "Job title" },
      { name: "candidateName", description: "Candidate name" },
      { name: "finishDate", description: "Contract finish date" },
      { name: "jobUrl", description: "Link to the job" },
    ],
    sampleValues: {
      jobTitle: "Senior Chemist",
      candidateName: "Jordan Lee",
      finishDate: "2026-09-30",
      jobUrl: "https://example.com/recruitment/jobs/sample",
    },
  },
  {
    key: "opportunity_stage_changed",
    label: "Opportunity stage changed",
    module: "recruitment",
    trigger: "A CRM opportunity moves to a new pipeline stage",
    variables: [
      { name: "opportunityTitle", description: "Opportunity title" },
      { name: "oldStage", description: "Previous stage" },
      { name: "newStage", description: "New stage" },
      { name: "opportunityUrl", description: "Link to the pipeline" },
    ],
    sampleValues: {
      opportunityTitle: "Acme Co — retained search",
      oldStage: "proposal",
      newStage: "negotiation",
      opportunityUrl: "https://example.com/recruitment/pipeline",
    },
  },
  {
    key: "timesheet_submitted",
    label: "Timesheet submitted",
    module: "timesheets",
    trigger: "A contractor submits a timesheet for approval",
    variables: [
      { name: "contractorName", description: "Contractor name" },
      { name: "weekStarting", description: "Week starting date" },
      { name: "approvalUrl", description: "Link for the supervisor to review" },
    ],
    sampleValues: {
      contractorName: "Jordan Lee",
      weekStarting: "2026-08-17",
      approvalUrl: "https://example.com/approvals/sample",
    },
  },
  {
    key: "timesheet_declined",
    label: "Timesheet declined",
    module: "timesheets",
    trigger: "A supervisor declines a submitted timesheet",
    variables: [
      { name: "weekStarting", description: "Week starting date" },
      { name: "reason", description: "Decline reason" },
      { name: "timesheetUrl", description: "Link for the contractor to amend" },
    ],
    sampleValues: {
      weekStarting: "2026-08-17",
      reason: "Hours on Thursday look duplicated — please double check.",
      timesheetUrl: "https://example.com/my-timesheets/sample",
    },
  },
  {
    key: "timesheet_approved",
    label: "Timesheet approved",
    module: "timesheets",
    trigger: "A supervisor approves a submitted timesheet",
    variables: [
      { name: "weekStarting", description: "Week starting date" },
      { name: "timesheetUrl", description: "Link to the timesheet" },
    ],
    sampleValues: {
      weekStarting: "2026-08-17",
      timesheetUrl: "https://example.com/my-timesheets/sample",
    },
  },
  {
    key: "application_unsuccessful",
    label: "Application unsuccessful",
    module: "recruitment",
    trigger: "Scheduled: an unsuccessful application's holding period elapses",
    variables: [
      { name: "candidateName", description: "Candidate name" },
      { name: "jobTitle", description: "Job title" },
      { name: "companyName", description: "Company name" },
    ],
    sampleValues: {
      candidateName: "Jordan Lee",
      jobTitle: "Senior Chemist",
      companyName: "Acme Co",
    },
  },
]

export function getTemplateMeta(key: string): EmailTemplateMeta | undefined {
  return EMAIL_TEMPLATE_REGISTRY.find((t) => t.key === key)
}

export function substituteVariables(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, name: string) => vars[name] ?? match)
}
