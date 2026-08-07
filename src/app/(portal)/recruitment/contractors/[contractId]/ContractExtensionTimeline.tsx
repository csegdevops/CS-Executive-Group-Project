interface Extension {
  id: string
  previous_finish_date: string
  new_finish_date: string
  new_pay_rate: number | null
  new_charge_rate: number | null
  notes: string | null
  extended_at: string
}

function formatDate(d: string | null): string {
  return d ? new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "Ongoing"
}

export function ContractExtensionTimeline({
  startDate, initialFinishDate, extensions,
}: {
  startDate: string | null
  initialFinishDate: string | null
  extensions: Extension[]
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="font-medium text-sm mb-3">Extension history</h3>
      <ol className="space-y-3">
        <li className="text-sm">
          <p className="font-medium">Initial contract</p>
          <p className="text-xs text-muted-foreground">{formatDate(startDate)} – {formatDate(initialFinishDate)}</p>
        </li>
        {extensions.map((e, i) => (
          <li key={e.id} className="text-sm border-l-2 border-border pl-3">
            <p className="font-medium">Extension {i + 1}</p>
            <p className="text-xs text-muted-foreground">
              {formatDate(e.previous_finish_date)} → {formatDate(e.new_finish_date)}
            </p>
            {(e.new_pay_rate != null || e.new_charge_rate != null) && (
              <p className="text-xs text-muted-foreground">Pay {e.new_pay_rate ?? "—"} / Charge {e.new_charge_rate ?? "—"}</p>
            )}
            {e.notes && <p className="text-xs text-muted-foreground">{e.notes}</p>}
          </li>
        ))}
        {extensions.length === 0 && <p className="text-xs text-muted-foreground">No extensions yet.</p>}
      </ol>
    </div>
  )
}
