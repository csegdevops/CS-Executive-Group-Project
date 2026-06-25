"use client"

import { useState, useMemo, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { formatDate } from "@/lib/date-helpers"

// ── Date helpers (mirrors ConsultationsAnalytics) ──────────────────────────
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
const YEARS  = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i)

function monthsBefore(n: number): string {
  const d = new Date(); d.setMonth(d.getMonth() - (n - 1))
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}
function currentYM() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}
function startOfYear(y: number) { return `${y}-01` }

// ── Constants ──────────────────────────────────────────────────────────────
const STATUS_STYLES: Record<string, string> = {
  draft:        "text-gray-600 border-gray-300",
  in_progress:  "text-blue-700 border-blue-300 bg-blue-50",
  under_review: "text-amber-700 border-amber-300 bg-amber-50",
  completed:    "text-green-700 border-green-300 bg-green-50",
  archived:     "text-gray-500 border-gray-200",
}
const STATUS_LABELS: Record<string, string> = {
  draft: "Draft", in_progress: "In Progress",
  under_review: "Under Review", completed: "Completed", archived: "Archived",
}
const FRAMEWORK_LABELS: Record<string, string> = { aicis: "AICIS", reach: "REACH", tsca: "TSCA" }

const PRESETS = [
  { label: "3M",  from: () => monthsBefore(3),  to: currentYM },
  { label: "6M",  from: () => monthsBefore(6),  to: currentYM },
  { label: "YTD", from: () => startOfYear(new Date().getFullYear()), to: currentYM },
  { label: "1Y",  from: () => monthsBefore(12), to: currentYM },
  { label: "2Y",  from: () => monthsBefore(24), to: currentYM },
]

// ── Types ──────────────────────────────────────────────────────────────────
interface ConsultationRow {
  id: string
  title: string
  status: string
  frameworks: string[]
  due_date: string | null
  updated_at: string
  company_id: string
  reference_number: string | null
}

interface Props {
  consultations: ConsultationRow[]
  companyNameById: Record<string, string>
  companies: { id: string; name: string }[]
  consultants: { id: string; name: string }[]
  consultationConsultants: { consultation_id: string; consultant_id: string }[]
  isAdmin: boolean
}

// ── Component ──────────────────────────────────────────────────────────────
export function ConsultationsListClient({
  consultations,
  companyNameById,
  companies,
  consultants,
  consultationConsultants,
  isAdmin,
}: Props) {
  const searchParams = useSearchParams()

  // fromInput/toInput: what the selectors display (always has a value)
  // fromMonth/toMonth: "" means period filter is OFF; non-empty means ON
  // Read initial values from URL so Back navigation restores filter state
  const [fromInput, setFromInput] = useState(() => searchParams.get("from") || monthsBefore(12))
  const [toInput,   setToInput]   = useState(() => searchParams.get("to") || currentYM())
  const [fromMonth, setFrom]      = useState(() => searchParams.get("from") || "")
  const [toMonth,   setTo]        = useState(() => searchParams.get("to") || "")
  const [company,   setCompany]   = useState(() => searchParams.get("company") || "")
  const [consultant, setConsultant] = useState(() => searchParams.get("consultant") || "")
  const [status,    setStatus]    = useState(() => searchParams.get("status") || "")

  // Sync filter state to URL in-place (no navigation); overrides apply the just-changed field
  const syncUrl = useCallback((overrides: Record<string, string> = {}) => {
    const vals: Record<string, string> = {
      from: fromMonth, to: toMonth, company, status, consultant, ...overrides,
    }
    const params = new URLSearchParams()
    searchParams.forEach((v, k) => {
      if (!["from","to","company","status","consultant"].includes(k)) params.set(k, v)
    })
    Object.entries(vals).forEach(([k, v]) => { if (v) params.set(k, v); else params.delete(k) })
    const qs = params.toString()
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname)
  }, [fromMonth, toMonth, company, status, consultant, searchParams])

  // Consultant → consultation lookup map
  const assigneeMap = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const { consultation_id, consultant_id } of consultationConsultants) {
      const list = map.get(consultation_id) ?? []
      list.push(consultant_id)
      map.set(consultation_id, list)
    }
    return map
  }, [consultationConsultants])

  // Active preset detection — only when period filter is on
  const activePreset = (fromMonth && toMonth)
    ? PRESETS.find((p) => p.from() === fromMonth && p.to() === toMonth)?.label ?? null
    : null

  const [fy, fm] = fromInput.split("-")
  const [ty, tm] = toInput.split("-")

  // Filtered list — period only applied when fromMonth is non-empty; null due_date always shown
  const filtered = useMemo(() => {
    let fromDate: Date | null = null
    let toDate:   Date | null = null
    if (fromMonth && toMonth) {
      const [fromY, fromM] = fromMonth.split("-")
      const [toY,   toM]   = toMonth.split("-")
      fromDate = new Date(+fromY, +fromM - 1, 1)
      toDate   = new Date(+toY, +toM, 0)        // last day of to-month
    }

    return consultations.filter((c) => {
      if (company && c.company_id !== company) return false
      if (status  && c.status !== status)       return false
      if (consultant) {
        if (!(assigneeMap.get(c.id) ?? []).includes(consultant)) return false
      }
      if (fromDate && toDate && c.due_date) {
        const due = new Date(c.due_date)
        if (due < fromDate || due > toDate) return false
      }
      return true
    })
  }, [consultations, fromMonth, toMonth, company, status, consultant, assigneeMap])

  const periodActive    = fromMonth !== ""
  const hasActiveFilter = periodActive || !!company || !!status || !!consultant

  function clearAll() {
    setFrom(""); setTo("")
    setCompany(""); setStatus(""); setConsultant("")
    const params = new URLSearchParams()
    searchParams.forEach((v, k) => {
      if (!["from","to","company","status","consultant"].includes(k)) params.set(k, v)
    })
    const qs = params.toString()
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname)
  }

  return (
    <div className="space-y-4">
      {/* ── Filter bar ──────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="py-3 px-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground shrink-0">Period</span>

            {/* From */}
            <div className="flex items-center gap-1">
              <select
                value={fm}
                onChange={(e) => {
                  const v = `${fy}-${e.target.value}`
                  setFromInput(v); setFrom(v)
                  const t2 = toMonth || toInput
                  if (!toMonth) setTo(t2)
                  syncUrl({ from: v, to: t2 })
                }}
                className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={String(i + 1).padStart(2, "0")}>{m}</option>
                ))}
              </select>
              <select
                value={fy}
                onChange={(e) => {
                  const v = `${e.target.value}-${fm}`
                  setFromInput(v); setFrom(v)
                  const t2 = toMonth || toInput
                  if (!toMonth) setTo(t2)
                  syncUrl({ from: v, to: t2 })
                }}
                className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              >
                {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            <span className="text-muted-foreground text-sm">to</span>

            {/* To */}
            <div className="flex items-center gap-1">
              <select
                value={tm}
                onChange={(e) => {
                  const v = `${ty}-${e.target.value}`
                  setToInput(v); setTo(v)
                  const f2 = fromMonth || fromInput
                  if (!fromMonth) setFrom(f2)
                  syncUrl({ to: v, from: f2 })
                }}
                className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={String(i + 1).padStart(2, "0")}>{m}</option>
                ))}
              </select>
              <select
                value={ty}
                onChange={(e) => {
                  const v = `${e.target.value}-${tm}`
                  setToInput(v); setTo(v)
                  const f2 = fromMonth || fromInput
                  if (!fromMonth) setFrom(f2)
                  syncUrl({ to: v, from: f2 })
                }}
                className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              >
                {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            {/* Presets */}
            <div className="flex gap-1">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => {
                    const f = p.from(); const t = p.to()
                    setFromInput(f); setFrom(f)
                    setToInput(t);   setTo(t)
                    syncUrl({ from: f, to: t })
                  }}
                  className={`h-7 px-2.5 rounded text-xs font-medium transition-colors ${
                    activePreset === p.label
                      ? "bg-primary text-primary-foreground"
                      : "border border-input bg-background hover:bg-muted"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Company */}
            <select
              value={company}
              onChange={(e) => { setCompany(e.target.value); syncUrl({ company: e.target.value }) }}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">All companies</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            {/* Status */}
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value); syncUrl({ status: e.target.value }) }}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">All statuses</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>

            {/* Consultant (admin only) */}
            {isAdmin && consultants.length > 0 && (
              <select
                value={consultant}
                onChange={(e) => { setConsultant(e.target.value); syncUrl({ consultant: e.target.value }) }}
                className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">All consultants</option>
                {consultants.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}

            {/* Count + clear */}
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs text-muted-foreground">
                {filtered.length} of {consultations.length}
              </span>
              {hasActiveFilter && (
                <button
                  onClick={clearAll}
                  className="h-7 px-2.5 rounded text-xs font-medium border border-input bg-background hover:bg-muted transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Title</th>
              <th className="text-left px-4 py-3 font-medium">Company</th>
              <th className="text-left px-4 py-3 font-medium">Frameworks</th>
              <th className="text-left px-4 py-3 font-medium">Due</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((c) => (
              <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3">
                  <Link href={`/regulatory/consultations/${c.id}`} className="font-medium hover:underline">
                    {c.title}
                  </Link>
                  {c.reference_number && (
                    <p className="text-xs text-muted-foreground">{c.reference_number}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {companyNameById[c.company_id] ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 flex-wrap">
                    {(c.frameworks ?? []).map((f: string) => (
                      <Badge key={f} variant="outline" className="text-xs">
                        {FRAMEWORK_LABELS[f] ?? f.toUpperCase()}
                      </Badge>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">
                  {formatDate(c.due_date)}
                </td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className={`text-xs ${STATUS_STYLES[c.status] ?? ""}`}>
                    {STATUS_LABELS[c.status] ?? c.status}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-10 text-muted-foreground text-sm">
            No consultations match the current filters.
          </div>
        )}
      </div>
    </div>
  )
}
