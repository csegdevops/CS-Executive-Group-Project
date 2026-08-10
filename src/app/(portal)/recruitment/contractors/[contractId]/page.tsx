import { requireModuleAccess } from "@/lib/auth-helpers"
import { createAdminClient } from "@/lib/supabase/admin"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ChevronLeft, TriangleAlert } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { CandidateSummaryCard } from "../../applications/[appId]/CandidateSummaryCard"
import { JobSummaryCard } from "../../applications/[appId]/JobSummaryCard"
import { ExtendContractDialog } from "./ExtendContractDialog"
import { RenewContractDialog } from "./RenewContractDialog"
import { TerminateContractDialog } from "./TerminateContractDialog"
import { ContractDocumentUpload } from "./ContractDocumentUpload"
import { ContractTermsCard } from "./ContractTermsCard"
import { RateTermsCard } from "./RateTermsCard"
import { WorkingHoursCard } from "./WorkingHoursCard"
import { ClientContactsCard } from "./ClientContactsCard"
import { ContractHistoryCard } from "./ContractHistoryCard"
import { ContractTimeline } from "./ContractTimeline"
import { getMissingContractFields } from "@/lib/recruitment/contract-completeness"

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-50 text-green-700",
  expired: "bg-gray-100 text-gray-500",
  terminated: "bg-red-50 text-red-600",
}

export default async function ContractDetailPage({ params }: { params: Promise<{ contractId: string }> }) {
  await requireModuleAccess("recruitment")
  const { contractId } = await params
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recruitment = admin.schema("recruitment") as any

  const { data: contract } = await recruitment
    .from("contracts")
    .select(`
      *,
      placement:placements(
        id, start_date, finish_date, pay_rate, charge_rate, currency, placement_type, status,
        job:jobs(id, title, reference_number, company_id, assigned_recruiter_id),
        candidate:candidates(id, first_name, last_name, email, phone, current_title, current_employer, location_city, location_state, skills_tags, security_clearance_level, security_clearance_verified)
      )
    `)
    .eq("id", contractId)
    .single()
  if (!contract) notFound()

  const [{ data: company }, { data: recruiterProfile }, { data: extensions }, { data: siblings }, { data: leavePeriods }, { data: notes }, { data: lookups }] = await Promise.all([
    contract.placement?.job?.company_id
      ? admin.from("companies").select("id, name").eq("id", contract.placement.job.company_id).single()
      : Promise.resolve({ data: null }),
    contract.placement?.job?.assigned_recruiter_id
      ? admin.from("profiles").select("full_name").eq("id", contract.placement.job.assigned_recruiter_id).maybeSingle()
      : Promise.resolve({ data: null }),
    recruitment.from("contract_extensions").select("*").eq("contract_id", contractId).order("extended_at", { ascending: true }),
    contract.placement_id
      ? recruitment
          .from("contracts")
          .select("id, contract_number, status, is_current, start_date, finish_date, created_at")
          .eq("placement_id", contract.placement_id)
          .order("start_date", { ascending: true })
      : Promise.resolve({ data: [] }),
    recruitment.from("contract_leave_periods").select("*").eq("contract_id", contractId).order("start_date", { ascending: true }),
    recruitment.from("contract_notes").select("*").eq("contract_id", contractId).order("created_at", { ascending: true }),
    admin.from("lookup_values").select("category, value, label").in("category", ["award", "award_level"]),
  ])

  const contactIds = [contract.recruitment_agreement_contact_id, contract.invoicing_contact_id, contract.timesheet_approver_contact_id].filter(Boolean) as string[]
  const { data: contactRows } = contactIds.length
    ? await admin.from("contacts").select("id, first_name, last_name, email").in("id", contactIds)
    : { data: [] }
  const contactMap = Object.fromEntries((contactRows ?? []).map((c: { id: string; first_name: string; last_name: string; email: string | null }) => [c.id, c]))

  // Timesheets supervisor and Client Contacts' "Timesheet approver" describe
  // the same real-world role — surfaced together in ClientContactsCard
  // rather than as a separate card.
  let timesheetsSupervisor: { full_name: string | null; email: string } | null = null
  if (contract.placement?.id) {
    const { data: tsContractor } = await admin
      .schema("timesheets")
      .from("contractors")
      .select("id")
      .eq("placement_id", contract.placement.id)
      .maybeSingle()

    if (tsContractor) {
      const { data: assignment } = await admin
        .schema("timesheets")
        .from("supervisor_assignments")
        .select("supervisor_id")
        .eq("contractor_id", tsContractor.id)
        .is("end_date", null)
        .maybeSingle()

      if (assignment) {
        const { data: supervisor } = await admin
          .schema("timesheets")
          .from("supervisors")
          .select("full_name, email")
          .eq("id", assignment.supervisor_id)
          .single()
        timesheetsSupervisor = supervisor ?? null
      }
    }
  }

  const placement = contract.placement
  const candidate = placement?.candidate ?? null
  const job = placement?.job
    ? { ...placement.job, company_name: company?.name ?? null, recruiter_name: recruiterProfile?.full_name ?? null }
    : null

  const today = new Date().toISOString().slice(0, 10)
  const isOnLeave = (leavePeriods ?? []).some(
    (l: { start_date: string; end_date: string | null }) => l.start_date <= today && (!l.end_date || l.end_date >= today)
  )

  const missingFields = getMissingContractFields(contract)

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <Link href="/recruitment/contractors" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-3.5 w-3.5" />All Contractors
        </Link>
        <div className="flex items-center gap-2">
          {isOnLeave && <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700">On Leave</Badge>}
          {missingFields.length > 0 && (
            <Badge variant="outline" className="text-xs bg-red-50 text-red-700 gap-1">
              <TriangleAlert className="h-3 w-3" />Incomplete — missing {missingFields.join(", ")}
            </Badge>
          )}
          <Badge variant="outline" className={cn("text-xs", STATUS_COLORS[contract.status] ?? "")}>
            {contract.status[0].toUpperCase() + contract.status.slice(1)}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-4">
          <CandidateSummaryCard candidate={candidate} hideSkills />

          <ContractTermsCard contract={contract} />
          <RateTermsCard contract={contract} lookups={lookups ?? []} />
          <WorkingHoursCard contract={contract} />
          <ClientContactsCard
            contract={{
              ...contract,
              company_id: job?.company_id ?? null,
              recruitment_agreement_contact: contract.recruitment_agreement_contact_id ? contactMap[contract.recruitment_agreement_contact_id] ?? null : null,
              invoicing_contact: contract.invoicing_contact_id ? contactMap[contract.invoicing_contact_id] ?? null : null,
              timesheet_approver_contact: contract.timesheet_approver_contact_id ? contactMap[contract.timesheet_approver_contact_id] ?? null : null,
            }}
            timesheetsSupervisor={timesheetsSupervisor}
            timesheetsProvisioned={Boolean(placement?.id)}
          />

          <ContractHistoryCard contracts={siblings ?? []} currentId={contract.id} />

          <ContractTimeline
            contractId={contract.id}
            contractNumber={contract.contract_number}
            createdAt={contract.created_at}
            currentContractId={contract.id}
            extensions={extensions ?? []}
            siblingRenewals={(siblings ?? []).filter((s: { id: string }) => s.id !== contract.id)}
            leavePeriods={leavePeriods ?? []}
            notes={notes ?? []}
            terminatedAt={contract.terminated_at}
            terminationReason={contract.termination_reason}
          />

          <ContractDocumentUpload
            contractId={contract.id}
            documentName={contract.document_original_name}
            editable={contract.status !== "terminated"}
          />
        </div>

        <div className="space-y-4">
          <JobSummaryCard job={job} />

          {contract.status !== "terminated" && contract.is_current && (
            <div className="rounded-lg border bg-card p-4 space-y-2">
              <h3 className="font-medium text-sm mb-1">Actions</h3>
              <ExtendContractDialog
                contractId={contract.id}
                currentFinishDate={contract.finish_date ?? placement?.finish_date ?? null}
              />
              <RenewContractDialog
                contract={{
                  id: contract.id,
                  contract_number: contract.contract_number,
                  notice_period: contract.notice_period,
                  finish_date: contract.finish_date ?? placement?.finish_date ?? null,
                  pay_rate: contract.pay_rate,
                  charge_rate: contract.charge_rate,
                  currency: contract.currency,
                  factor_rate: contract.factor_rate,
                  pay_rate_excl_casual_loading: contract.pay_rate_excl_casual_loading,
                  award: contract.award,
                  award_level: contract.award_level,
                  payment_terms_days: contract.payment_terms_days,
                  overtime_applicable: contract.overtime_applicable,
                  po_required: contract.po_required,
                  position_title: contract.position_title,
                  safety_course_required: contract.safety_course_required,
                  view_to_extend: contract.view_to_extend,
                  permanent_conversion_status: contract.permanent_conversion_status,
                  next_award_review_date: contract.next_award_review_date,
                  reporting_contact_name: contract.reporting_contact_name,
                  reporting_contact_email: contract.reporting_contact_email,
                  work_attire_ppe: contract.work_attire_ppe,
                  working_hours: contract.working_hours,
                  lunch_break_minutes: contract.lunch_break_minutes,
                  start_time_first_day: contract.start_time_first_day,
                  job_reference_number: job?.reference_number ?? null,
                  job_title: job?.title ?? null,
                }}
              />
              <TerminateContractDialog contractId={contract.id} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
