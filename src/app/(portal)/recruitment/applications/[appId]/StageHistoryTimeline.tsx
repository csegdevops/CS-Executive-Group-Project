const STAGE_LABELS: Record<string, string> = {
  applied: "Applied", screening: "Screening", shortlisted: "Shortlisted",
  interview_1: "Interview 1", interview_2: "Interview 2",
  reference_check: "Ref Check", offer: "Offer", placed: "Placed",
  withdrawn: "Withdrawn", rejected: "Rejected",
}

export interface StageHistoryEntry {
  id: string
  from_stage: string | null
  to_stage: string
  notes: string | null
  changer_name: string | null
  changed_at: string
}

export function StageHistoryTimeline({ history }: { history: StageHistoryEntry[] }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="font-medium text-sm mb-3">Stage history</h3>
      <div className="space-y-2">
        {history.map((h) => (
          <div key={h.id} className="flex items-start gap-3 text-sm">
            <div className="mt-1 h-2 w-2 rounded-full bg-muted-foreground/30 shrink-0" />
            <div className="flex-1">
              <p>
                {h.from_stage ? `${STAGE_LABELS[h.from_stage] ?? h.from_stage} → ` : ""}
                <span className="font-medium">{STAGE_LABELS[h.to_stage] ?? h.to_stage}</span>
                {h.changer_name ? ` by ${h.changer_name}` : ""}
              </p>
              {h.notes ? <p className="text-xs text-muted-foreground mt-0.5">{h.notes}</p> : null}
              <p className="text-xs text-muted-foreground">
                {new Date(h.changed_at).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
