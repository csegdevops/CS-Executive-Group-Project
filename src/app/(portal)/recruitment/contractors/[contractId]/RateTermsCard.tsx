import { EditRateTermsDialog, type RateTerms } from "./EditRateTermsDialog"

interface LookupValue { category: string; value: string; label: string }

export interface RateTermsData extends RateTerms {
  id: string
  status: string
  factor_rate: number | null
  pay_rate_excl_casual_loading: number | null
  charge_rate: number | null
}

export function RateTermsCard({ contract, lookups, onSaved }: { contract: RateTermsData; lookups?: LookupValue[]; onSaved?: () => void }) {
  const chargeIncGst = contract.charge_rate != null ? (Number(contract.charge_rate) * 1.1).toFixed(2) : null
  const lookupLabel = (category: string, value: string | null) =>
    value ? (lookups ?? []).find((l) => l.category === category && l.value === value)?.label ?? value : "—"

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm">Rate & terms of business</h3>
        {contract.status !== "terminated" && <EditRateTermsDialog contractId={contract.id} terms={contract} onSaved={onSaved} />}
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Award</p>
          <p>{lookupLabel("award", contract.award)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Award level</p>
          <p>{lookupLabel("award_level", contract.award_level)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Factor rate</p>
          <p>{contract.factor_rate ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Pay rate (Exc. casual loading)</p>
          <p>{contract.pay_rate_excl_casual_loading ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Client rate (Inc. GST)</p>
          <p>{chargeIncGst ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Payment terms</p>
          <p>{contract.payment_terms_days != null ? `${contract.payment_terms_days} days` : "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Overtime applied</p>
          <p>{contract.overtime_applicable ? "Yes" : "No"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">PO required</p>
          <p>{contract.po_required ? "Yes" : "No"}</p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Rate changes require a contract renewal (see Actions).</p>
    </div>
  )
}
