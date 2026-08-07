import { requireModuleAccess } from "@/lib/auth-helpers"
import { createAdminClient } from "@/lib/supabase/admin"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { CandidateSummaryCard } from "../../applications/[appId]/CandidateSummaryCard"
import { JobSummaryCard } from "../../applications/[appId]/JobSummaryCard"
import { ExtendContractDialog } from "./ExtendContractDialog"
import { TerminateContractDialog } from "./TerminateContractDialog"
import { ContractDocumentUpload } from "./ContractDocumentUpload"
import { EditContractDetailsDialog } from "./EditContractDetailsDialog"
import { ContractExtensionTimeline } from "./ContractExtensionTimeline"

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
        job:jobs(id, title, reference_number, company_id),
        candidate:candidates(id, first_name, last_name, email, phone, current_title, current_employer, location_city, location_state, skills_tags, security_clearance_level, security_clearance_verified)
      )
    `)
    .eq("id", contractId)
    .single()
  if (!contract) notFound()

  const [{ data: company }, { data: extensions }] = await Promise.all([
    contract.placement?.job?.company_id
      ? admin.from("companies").select("id, name").eq("id", contract.placement.job.company_id).single()
      : Promise.resolve({ data: null }),
    recruitment.from("contract_extensions").select("*").eq("contract_id", contractId).order("extended_at", { ascending: true }),
  ])

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
  const job = placement?.job ? { ...placement.job, company_name: company?.name ?? null } : null

  // Initial period's end date: the earliest extension's previous_finish_date
  // if any extensions exist, else the placement's current finish_date.
  const initialFinishDate = extensions?.length ? extensions[0].previous_finish_date : placement?.finish_date ?? null

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <Link href="/recruitment/contractors" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-3.5 w-3.5" />All Contractors
        </Link>
        <Badge variant="outline" className={cn("text-xs", STATUS_COLORS[contract.status] ?? "")}>
          {contract.status[0].toUpperCase() + contract.status.slice(1)}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-4">
          <CandidateSummaryCard candidate={candidate} />

          <div className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-sm">Contract terms</h3>
              {contract.status !== "terminated" && <EditContractDetailsDialog contractId={contract.id} contractNumber={contract.contract_number} noticePeriod={contract.notice_period} />}
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Start date</p>
                <p>{placement?.start_date ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Current finish date</p>
                <p>{placement?.finish_date ?? "Ongoing"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pay rate (paid to contractor)</p>
                <p>{placement?.pay_rate != null ? `${placement.pay_rate} ${placement.currency}` : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Charge rate (billed to company)</p>
                <p>{placement?.charge_rate != null ? `${placement.charge_rate} ${placement.currency}` : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Contract number</p>
                <p>{contract.contract_number ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Notice period</p>
                <p>{contract.notice_period ?? "—"}</p>
              </div>
            </div>
            {contract.status === "terminated" && (
              <p className="text-xs text-destructive">
                Terminated{contract.termination_reason ? ` — ${contract.termination_reason}` : ""}
              </p>
            )}
          </div>

          <ContractExtensionTimeline
            startDate={placement?.start_date ?? null}
            initialFinishDate={initialFinishDate}
            extensions={extensions ?? []}
          />

          <ContractDocumentUpload
            contractId={contract.id}
            documentName={contract.document_original_name}
            editable={contract.status !== "terminated"}
          />
        </div>

        <div className="space-y-4">
          <JobSummaryCard job={job} />

          {contract.status !== "terminated" && (
            <div className="rounded-lg border bg-card p-4 space-y-2">
              <h3 className="font-medium text-sm mb-1">Actions</h3>
              <ExtendContractDialog
                contractId={contract.id}
                currentFinishDate={placement?.finish_date ?? null}
                currentPayRate={placement?.pay_rate ?? null}
                currentChargeRate={placement?.charge_rate ?? null}
              />
              <TerminateContractDialog contractId={contract.id} />
            </div>
          )}

          <div className="rounded-lg border bg-card p-4">
            <h3 className="font-medium text-sm mb-2">Timesheets supervisor</h3>
            {timesheetsSupervisor ? (
              <div className="text-sm">
                <p>{timesheetsSupervisor.full_name ?? "—"}</p>
                <p className="text-xs text-muted-foreground">{timesheetsSupervisor.email}</p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                {placement?.id ? "Not provisioned for the Timesheets portal, or no supervisor assigned yet." : "—"}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
