"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, RefreshCw } from "lucide-react"
import { formatDate } from "@/lib/date-helpers"

interface Consultation {
  id: string
  title: string
  status: string
  due_date: string | null
  updated_at: string
  frameworks: string[]
  reference_number: string | null
  companies: { id: string; name: string } | null
}

const STATUS_STYLES: Record<string, string> = {
  in_progress:  "bg-blue-100 text-blue-700 border-blue-300",
  under_review: "bg-amber-100 text-amber-700 border-amber-300",
}

const STATUS_LABELS: Record<string, string> = {
  in_progress:  "In Progress",
  under_review: "Under Review",
}

const FRAMEWORK_LABELS: Record<string, string> = { aicis: "AICIS", reach: "REACH", tsca: "TSCA" }

const POLL_INTERVAL = 30_000

export function OngoingConsultations() {
  const [consultations, setConsultations] = useState<Consultation[]>([])
  const [loading, setLoading]             = useState(true)
  const [lastUpdated, setLastUpdated]     = useState<Date | null>(null)
  const [error, setError]                 = useState(false)

  const fetchConsultations = useCallback(async () => {
    try {
      const res = await fetch("/api/consultations?status=in_progress,under_review", {
        cache: "no-store",
      })
      if (!res.ok) { setError(true); return }
      setConsultations(await res.json())
      setLastUpdated(new Date())
      setError(false)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConsultations()
    const id = setInterval(fetchConsultations, POLL_INTERVAL)
    return () => clearInterval(id)
  }, [fetchConsultations])

  const now = new Date()

  if (loading) {
    return (
      <div className="h-20 flex items-center justify-center text-xs text-muted-foreground">
        Loading…
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-xs text-destructive">
        <AlertCircle className="h-3.5 w-3.5" />
        Failed to load — retrying automatically
      </div>
    )
  }

  if (consultations.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No consultations currently in progress or under review.</p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium text-xs">Consultation</th>
              <th className="text-left px-4 py-2.5 font-medium text-xs">Company</th>
              <th className="text-left px-4 py-2.5 font-medium text-xs">Status</th>
              <th className="text-left px-4 py-2.5 font-medium text-xs">Frameworks</th>
              <th className="text-left px-4 py-2.5 font-medium text-xs">Due Date</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {consultations.map((c) => {
              const dueDate  = c.due_date ? new Date(c.due_date) : null
              const isOverdue = dueDate ? dueDate < now : false

              return (
                <tr key={c.id} className={`hover:bg-muted/30 transition-colors ${isOverdue ? "bg-red-50/30" : ""}`}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/regulatory/consultations/${c.id}`}
                      className="font-medium hover:underline"
                    >
                      {c.title}
                    </Link>
                    {c.reference_number && (
                      <div className="text-xs text-muted-foreground">{c.reference_number}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {c.companies?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium rounded-full border px-2.5 py-0.5 ${STATUS_STYLES[c.status] ?? ""}`}>
                      {STATUS_LABELS[c.status] ?? c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {(c.frameworks ?? []).map((f) => (
                        <Badge key={f} variant="outline" className="text-xs">
                          {FRAMEWORK_LABELS[f] ?? f.toUpperCase()}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {dueDate ? (
                      <span className={`text-xs ${isOverdue ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                        {isOverdue && <AlertCircle className="h-3 w-3 inline mr-1" />}
                        {formatDate(c.due_date)}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {lastUpdated && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <RefreshCw className="h-3 w-3" />
          Updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · refreshes every 30s
        </div>
      )}
    </div>
  )
}
