"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"

interface LogEntry {
  id: string
  user_id: string
  user_name: string
  action: string
  details: Record<string, unknown> | null
  created_at: string
}

function humanAction(action: string, details: Record<string, unknown> | null): string {
  switch (action) {
    case "created":
      return "Created consultation"
    case "chemicals_added": {
      const added      = (details?.added as number) ?? 0
      const unresolved = (details?.unresolved as number) ?? 0
      const parts = [`Added ${added} ingredient${added !== 1 ? "s" : ""}`]
      if (unresolved > 0) parts.push(`${unresolved} unresolved`)
      return parts.join(", ")
    }
    case "chemical_removed":
      return "Removed an ingredient"
    case "consultant_assigned":
      return `Assigned consultant${details?.name ? `: ${details.name}` : ""}`
    case "consultant_removed":
      return `Removed consultant${details?.name ? `: ${details.name}` : ""}`
    case "status_changed":
      return `Status changed to ${String(details?.status ?? "").replace("_", " ")}`
    default:
      return action.replace(/_/g, " ")
  }
}

export function LogsTab({ consultationId }: { consultationId: string }) {
  const [logs, setLogs]       = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/consultations/${consultationId}/logs`)
      .then((r) => r.ok ? r.json() : r.json().then((e) => Promise.reject(e.error)))
      .then(setLogs)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [consultationId])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm py-8">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading logs…
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-destructive py-4">{error}</p>
  }

  if (logs.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">No activity logged yet.</p>
  }

  return (
    <div className="space-y-1">
      {logs.map((log) => {
        const dt = new Date(log.created_at)
        return (
          <div key={log.id} className="flex gap-4 text-sm py-2 border-b last:border-0">
            <time
              className="text-xs text-muted-foreground tabular-nums whitespace-nowrap pt-0.5 min-w-[130px]"
              dateTime={log.created_at}
            >
              {dt.toLocaleDateString()} {dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </time>
            <div className="flex-1 min-w-0">
              <span className="font-medium">{log.user_name}</span>
              <span className="text-muted-foreground"> — {humanAction(log.action, log.details)}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
