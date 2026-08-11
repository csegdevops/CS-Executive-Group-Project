"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"

interface FieldChange {
  field: string
  old: unknown
  new: unknown
}

interface LogEntry {
  id: string
  action: string
  details: { source_channel?: string; email?: string; changes?: FieldChange[] } | null
  performed_by: string | null
  performed_by_name: string | null
  created_at: string
}

function fmtValue(v: unknown): string {
  if (v == null || v === "") return "—"
  if (Array.isArray(v)) return v.length ? v.join(", ") : "—"
  if (typeof v === "boolean") return v ? "Yes" : "No"
  if (typeof v === "object") return JSON.stringify(v)
  return String(v)
}

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString("en-AU", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  })
}

export function CandidateLogsTab({ candidateId }: { candidateId: string }) {
  const [logs, setLogs] = useState<LogEntry[] | null>(null)

  useEffect(() => {
    fetch(`/api/recruitment/candidates/${candidateId}/logs`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setLogs)
      .catch(() => setLogs([]))
  }, [candidateId])

  if (logs === null) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    )
  }

  if (logs.length === 0) {
    return <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
  }

  return (
    <div className="max-w-2xl space-y-4">
      <p className="text-xs text-muted-foreground">
        Registration shows who added the candidate (blank means they registered themselves via the
        website). Profile changes are captured automatically from every source — manual edits,
        website re-submissions, CV re-parses — but individual edits aren&apos;t attributed to a
        specific admin.
      </p>

      <div className="space-y-3">
        {logs.map((log) => (
          <div key={log.id} className="rounded-md border bg-card p-3 text-sm">
            <div className="flex items-baseline justify-between gap-2 mb-1">
              <p className="font-medium">
                {log.action === "registered" ? "Candidate registered" : "Profile updated"}
                {log.performed_by_name && (
                  <span className="ml-1.5 text-xs font-normal text-muted-foreground">by {log.performed_by_name}</span>
                )}
              </p>
              <span className="text-xs text-muted-foreground shrink-0">{fmtDateTime(log.created_at)}</span>
            </div>

            {log.action === "registered" && (
              <p className="text-xs text-muted-foreground">
                {log.details?.source_channel ?? "manual"}
                {log.details?.email ? ` · ${log.details.email}` : ""}
              </p>
            )}

            {log.action === "updated" && log.details?.changes && (
              <ul className="mt-1 space-y-1">
                {log.details.changes.map((c, i) => (
                  <li key={i} className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground/70 capitalize">{c.field.replace(/_/g, " ")}</span>
                    {": "}{fmtValue(c.old)} → {fmtValue(c.new)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
