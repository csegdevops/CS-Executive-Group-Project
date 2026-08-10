import { EditContractDetailsDialog, type ContractDetails } from "./EditContractDetailsDialog"
import { EditContractDatesDialog } from "./EditContractDatesDialog"

const PERM_CONVERSION_LABELS: Record<string, string> = {
  not_notified: "Not Notified Yet",
  notified: "Notified",
  converted: "Converted",
  declined: "Declined",
  not_applicable: "Not Applicable",
}

export interface ContractTermsData extends ContractDetails {
  id: string
  status: string
  start_date: string | null
  finish_date: string | null
  pay_rate: number | null
  charge_rate: number | null
  currency: string | null
  termination_reason: string | null
}

export function ContractTermsCard({ contract, onSaved }: { contract: ContractTermsData; onSaved?: () => void }) {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm">Contract terms</h3>
        <div className="flex items-center gap-1">
          {contract.status !== "terminated" && (
            <EditContractDatesDialog contractId={contract.id} startDate={contract.start_date} finishDate={contract.finish_date} onSaved={onSaved} />
          )}
          {contract.status !== "terminated" && <EditContractDetailsDialog contractId={contract.id} details={contract} onSaved={onSaved} />}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Start date</p>
          <p>{contract.start_date ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Current finish date</p>
          <p>{contract.finish_date ?? "Ongoing"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Pay rate (paid to contractor)</p>
          <p>{contract.pay_rate != null ? `${contract.pay_rate} ${contract.currency}` : "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Charge rate (billed to company)</p>
          <p>{contract.charge_rate != null ? `${contract.charge_rate} ${contract.currency}` : "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Contract number</p>
          <p>{contract.contract_number ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Notice period</p>
          <p>{contract.notice_period ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Position title</p>
          <p>{contract.position_title ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Permanent conversion</p>
          <p>{PERM_CONVERSION_LABELS[contract.permanent_conversion_status] ?? contract.permanent_conversion_status}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Next award review date</p>
          <p>{contract.next_award_review_date ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Actual finish date</p>
          <p>{contract.actual_finish_date ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Last payment date</p>
          <p>{contract.last_payment_date ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Safety course / View to extend</p>
          <p>{contract.safety_course_required ? "Required" : "Not required"} / {contract.view_to_extend ? "Yes" : "No"}</p>
        </div>
        <div className="col-span-2">
          <p className="text-xs text-muted-foreground">First-day reporting contact</p>
          <p>{contract.reporting_contact_name ?? "—"}{contract.reporting_contact_email ? ` (${contract.reporting_contact_email})` : ""}</p>
        </div>
        <div className="col-span-2">
          <p className="text-xs text-muted-foreground">Work attire & PPE</p>
          <p>{contract.work_attire_ppe ?? "—"}</p>
        </div>
      </div>
      {contract.status === "terminated" && (
        <p className="text-xs text-destructive">
          Terminated{contract.termination_reason ? ` — ${contract.termination_reason}` : ""}
        </p>
      )}
    </div>
  )
}
