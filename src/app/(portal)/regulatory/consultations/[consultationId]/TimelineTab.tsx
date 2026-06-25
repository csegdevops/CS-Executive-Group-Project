"use client"

import { useState, useEffect } from "react"
import { CheckCircle2, Circle, Loader2 } from "lucide-react"

interface LogEntry {
  id: string
  action: string
  details: Record<string, unknown> | null
  created_at: string
  user_name: string | null
}

type MilestoneKey = "consultation" | "chemicals" | "volumes" | "regulatory" | "review" | "complete"

function getMilestone(action: string, details: Record<string, unknown> | null): MilestoneKey {
  switch (action) {
    case "chemicals_added":
    case "chemical_removed":
    case "chemical_resolved":
    case "chemical_pushed_to_db":
    case "chemical_reassigned":
      return "chemicals"

    case "details_updated": {
      // Route status field changes to the milestone they represent
      if ((details?.field as string | undefined) === "status") {
        const next = (details?.new as string | undefined) ?? ""
        if (next === "completed")    return "complete"
        if (next === "under_review") return "review"
      }
      return "consultation"
    }

    // Kept for backwards-compat with any old log entries that used this action name
    case "status_changed": {
      const s = (details?.new_status as string | undefined) ?? ""
      if (s === "completed")    return "complete"
      if (s === "under_review") return "review"
      return "consultation"
    }

    default:
      return "consultation"
  }
}

function describeLog(action: string, details: Record<string, unknown> | null): string {
  switch (action) {
    case "created": return "Consultation created"
    case "chemicals_added": {
      const added      = Number(details?.added ?? 0)
      const unresolved = Number(details?.unresolved ?? 0)
      const skipped    = Number(details?.skipped ?? 0)
      const parts = [`${added} ingredient${added !== 1 ? "s" : ""} added`]
      if (unresolved > 0) parts.push(`${unresolved} unresolved`)
      if (skipped > 0)    parts.push(`${skipped} skipped`)
      return parts.join(", ")
    }
    case "chemical_removed":      return "Removed an ingredient"
    case "chemical_resolved":     return "Resolved an unresolved ingredient"
    case "chemical_pushed_to_db": return "Pushed ingredient to global database (pending review)"
    case "chemical_reassigned": {
      const from = details?.from ? `"${details.from}"` : "(no product)"
      const to   = details?.to   ? `"${details.to}"`   : "(no product)"
      return `Moved ingredient from ${from} to ${to}`
    }
    case "details_updated": {
      if ((details?.field as string | undefined) === "status") {
        const fmtStatus = (s: unknown) => String(s ?? "").replace(/_/g, " ")
        return `Status changed from "${fmtStatus(details?.old)}" to "${fmtStatus(details?.new)}"`
      }
      const field = String(details?.field ?? "field").replace(/_/g, " ")
      const fmt = (v: unknown) =>
        v == null || v === "" ? "—" : Array.isArray(v) ? (v as string[]).join(", ") : String(v)
      return `Updated ${field}: ${fmt(details?.old)} → ${fmt(details?.new)}`
    }
    case "note_added":          return "Added a consultant note"
    case "consultant_assigned": return "Consultant assigned"
    case "consultant_removed":  return "Consultant removed"
    case "status_changed": {
      const s = String(details?.new_status ?? "").replace(/_/g, " ")
      return `Status changed to "${s}"`
    }
    default: return action.replace(/_/g, " ")
  }
}

interface ChecklistState {
  chemicalsAdded: boolean
  volumesEntered: boolean
  regulatoryAssessed: boolean
  sentForReview: boolean
  complete: boolean
}

interface Props {
  consultationId: string
  checklist: ChecklistState
  chemicalsSummary: string
  volumesSummary: string
  regulatorySummary: string
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-AU", {
    day: "numeric", month: "short", year: "numeric",
  })
}

export function TimelineTab({
  consultationId,
  checklist,
  chemicalsSummary,
  volumesSummary,
  regulatorySummary,
}: Props) {
  const [logs, setLogs]     = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/consultations/${consultationId}/logs`)
      .then((r) => r.ok ? r.json() : [])
      .then((data: LogEntry[]) => {
        // API returns newest-first; we want chronological order within each group
        setLogs([...data].reverse())
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [consultationId])

  interface Milestone {
    key: MilestoneKey
    label: string
    done: boolean
    summary?: string
    noLogs?: true
  }

  const milestones: Milestone[] = [
    { key: "consultation", label: "Consultation created",       done: true },
    { key: "chemicals",    label: "Chemicals",                   done: checklist.chemicalsAdded,    summary: chemicalsSummary },
    { key: "volumes",      label: "Volumes entered",             done: checklist.volumesEntered,    summary: volumesSummary,    noLogs: true },
    { key: "regulatory",   label: "Regulatory status assessed", done: checklist.regulatoryAssessed, summary: regulatorySummary, noLogs: true },
    { key: "review",       label: "Sent for review",             done: checklist.sentForReview },
    { key: "complete",     label: "Assessment complete",         done: checklist.complete },
  ]

  // Group logs by milestone key
  const grouped = new Map<MilestoneKey, LogEntry[]>()
  for (const log of logs) {
    const key = getMilestone(log.action, log.details)
    const arr = grouped.get(key) ?? []
    arr.push(log)
    grouped.set(key, arr)
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      {milestones.map((m, i) => {
        const entries = m.noLogs ? [] : (grouped.get(m.key) ?? [])
        const isLast  = i === milestones.length - 1

        // Show the date of the first log entry for this milestone (if any)
        const firstDate = entries[0]?.created_at

        return (
          <div key={m.key} className="flex gap-4">
            {/* Left: icon + connector line */}
            <div className="flex flex-col items-center w-5 shrink-0">
              {m.done
                ? <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                : <Circle       className="h-5 w-5 text-muted-foreground/30 shrink-0 mt-0.5" />
              }
              {!isLast && (
                <div className="w-px flex-1 bg-border mt-1 min-h-[2rem]" />
              )}
            </div>

            {/* Right: milestone heading + log entries */}
            <div className={`pb-6 flex-1 min-w-0 ${!m.done ? "opacity-40" : ""}`}>
              <div className="flex items-baseline gap-2 mt-0.5">
                <p className="text-sm font-semibold leading-5">{m.label}</p>
                {firstDate && (
                  <span className="text-xs text-muted-foreground">{fmtDate(firstDate)}</span>
                )}
              </div>

              {m.summary && (
                <p className="text-xs text-muted-foreground mt-0.5">{m.summary}</p>
              )}

              {entries.length > 0 && (
                <ul className="mt-2 space-y-1.5">
                  {entries.map((log) => (
                    <li key={log.id} className="flex items-baseline gap-2 text-xs text-muted-foreground">
                      <span className="mt-[5px] h-1 w-1 rounded-full bg-muted-foreground/40 shrink-0" />
                      <span className="min-w-0">
                        {log.user_name && (
                          <span className="font-medium text-foreground/70">{log.user_name} · </span>
                        )}
                        {describeLog(log.action, log.details)}
                        <span className="ml-2 text-muted-foreground/50">{fmtDate(log.created_at)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
