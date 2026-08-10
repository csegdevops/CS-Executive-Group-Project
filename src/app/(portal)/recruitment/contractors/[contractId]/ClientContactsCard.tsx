import { EditClientContactsDialog } from "./EditClientContactsDialog"

interface ContactRef { first_name: string; last_name: string; email: string | null }
interface SupervisorRef { full_name: string | null; email: string }

export interface ClientContactsData {
  id: string
  status: string
  company_id: string | null
  recruitment_agreement_contact_id: string | null
  invoicing_contact_id: string | null
  timesheet_approver_contact_id: string | null
  recruitment_agreement_contact?: ContactRef | null
  invoicing_contact?: ContactRef | null
  timesheet_approver_contact?: ContactRef | null
}

function label(contact: ContactRef | null | undefined): string {
  if (!contact) return "—"
  return `${contact.first_name} ${contact.last_name}${contact.email ? ` (${contact.email})` : ""}`
}

export function ClientContactsCard({
  contract, timesheetsSupervisor, timesheetsProvisioned, onSaved,
}: {
  contract: ClientContactsData
  /** "Timesheets supervisor" and "Timesheet approver" are the same
   * real-world role — the client contact above is who the role belongs to;
   * this is whether that role is actually provisioned with portal login
   * access to approve timesheets there. */
  timesheetsSupervisor?: SupervisorRef | null
  timesheetsProvisioned?: boolean
  onSaved?: () => void
}) {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm">Client contacts</h3>
        {contract.status !== "terminated" && (
          <EditClientContactsDialog
            contractId={contract.id}
            companyId={contract.company_id}
            current={{
              recruitment_agreement_contact_id: contract.recruitment_agreement_contact_id,
              invoicing_contact_id: contract.invoicing_contact_id,
              timesheet_approver_contact_id: contract.timesheet_approver_contact_id,
            }}
            onSaved={onSaved}
          />
        )}
      </div>
      <div className="space-y-2 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Recruitment Agreement contact</p>
          <p>{label(contract.recruitment_agreement_contact)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Invoicing contact</p>
          <p>{label(contract.invoicing_contact)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Timesheet approver</p>
          <p>{label(contract.timesheet_approver_contact)}</p>
          {timesheetsSupervisor ? (
            <p className="text-xs text-muted-foreground mt-0.5">
              Provisioned on Timesheets portal as {timesheetsSupervisor.full_name ?? timesheetsSupervisor.email}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-0.5">
              {timesheetsProvisioned ? "Not yet provisioned on the Timesheets portal." : "—"}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
