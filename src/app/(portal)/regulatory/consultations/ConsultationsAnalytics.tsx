"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, TrendingUp, Building2, Users, CheckCircle2 } from "lucide-react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts"

// ── Types ──────────────────────────────────────────────────────────────────
interface AnalyticsData {
  monthly: { month: string; label: string; draft: number; in_progress: number; under_review: number; completed: number; archived: number; total: number }[]
  byCompany: { company: string; total: number; draft: number; in_progress: number; under_review: number; completed: number; archived: number }[]
  byConsultant: { name: string; total: number }[]
  statusTotals: { status: string; label: string; count: number }[]
  total: number
  companiesInvolved: number
  consultantsInvolved: number
  range: { from: string; to: string }
}

// ── Colour palette ─────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  draft:        "#94a3b8",
  in_progress:  "#3b82f6",
  under_review: "#f59e0b",
  completed:    "#22c55e",
  archived:     "#64748b",
}
const STATUS_LABELS: Record<string, string> = {
  draft: "Draft", in_progress: "In Progress",
  under_review: "Under Review", completed: "Completed", archived: "Archived",
}
const STATUSES = ["draft", "in_progress", "under_review", "completed", "archived"] as const

const COMPANY_COLOR  = "#6366f1"
const CONSULTANT_COLOR = "#0ea5e9"

// ── Date helpers ──────────────────────────────────────────────────────────
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

// ── Stat card ─────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: number | string; sub?: string; color: string
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className="rounded-lg p-2" style={{ backgroundColor: color + "22" }}>
            <Icon className="h-5 w-5" style={{ color }} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Tooltip formatters ─────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function StatusTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s: number, p: { value: number }) => s + (p.value ?? 0), 0)
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 shadow-lg text-sm min-w-[160px]">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((p: { name: string; value: number; color: string }) => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2 w-2 rounded-full inline-block" style={{ background: p.color }} />
            {STATUS_LABELS[p.name] ?? p.name}
          </span>
          <span className="font-medium">{p.value}</span>
        </div>
      ))}
      <div className="border-t mt-1 pt-1 flex justify-between text-muted-foreground">
        <span>Total</span><span className="font-medium">{total}</span>
      </div>
    </div>
  )
}

// Centre label rendered inside the donut hole via a custom label prop
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DonutCenterLabel({ viewBox, total }: { viewBox?: any; total: number }) {
  const { cx, cy } = viewBox ?? { cx: 0, cy: 0 }
  return (
    <g>
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize={22} fontWeight={700} className="fill-foreground">{total}</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize={11} className="fill-muted-foreground">total</text>
    </g>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
export function ConsultationsAnalytics() {
  const [data, setData]         = useState<AnalyticsData | null>(null)
  const [loading, setLoading]   = useState(true)
  const [fromMonth, setFrom]    = useState(monthsBefore(12))
  const [toMonth, setTo]        = useState(currentYM)
  
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/analytics/consultations?from=${fromMonth}&to=${toMonth}`)
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [fromMonth, toMonth])

  useEffect(() => { fetchData() }, [fetchData])

  // Preset buttons
  const presets = [
    { label: "3M",   from: monthsBefore(3),  to: currentYM() },
    { label: "6M",   from: monthsBefore(6),  to: currentYM() },
    { label: "YTD",  from: startOfYear(new Date().getFullYear()), to: currentYM() },
    { label: "1Y",   from: monthsBefore(12), to: currentYM() },
    { label: "2Y",   from: monthsBefore(24), to: currentYM() },
  ]
  const isPreset = (p: { from: string; to: string }) => p.from === fromMonth && p.to === toMonth

  const [fy, fm] = fromMonth.split("-")
  const [ty, tm] = toMonth.split("-")

  const completionRate = data && data.total > 0
    ? Math.round((data.statusTotals.find(s => s.status === "completed")?.count ?? 0) / data.total * 100)
    : 0

  return (
    <div className="space-y-5 mb-8">
      {/* ── Filter bar ──────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="py-3 px-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground shrink-0">Period</span>

            {/* From */}
            <div className="flex items-center gap-1">
              <select
                value={fm}
                onChange={(e) => setFrom(`${fy}-${e.target.value}`)}
                className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={String(i + 1).padStart(2, "0")}>{m}</option>
                ))}
              </select>
              <select
                value={fy}
                onChange={(e) => setFrom(`${e.target.value}-${fm}`)}
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
                onChange={(e) => setTo(`${ty}-${e.target.value}`)}
                className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={String(i + 1).padStart(2, "0")}>{m}</option>
                ))}
              </select>
              <select
                value={ty}
                onChange={(e) => setTo(`${e.target.value}-${tm}`)}
                className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              >
                {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            {/* Presets */}
            <div className="flex gap-1 ml-auto">
              {presets.map((p) => (
                <button
                  key={p.label}
                  onClick={() => { setFrom(p.from); setTo(p.to) }}
                  className={`h-7 px-2.5 rounded text-xs font-medium transition-colors ${
                    isPreset(p)
                      ? "bg-primary text-primary-foreground"
                      : "border border-input bg-background hover:bg-muted"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
        </CardContent>
      </Card>

      {/* ── KPI cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={TrendingUp}   label="Total Consultations" value={data?.total ?? "—"}                color="#3b82f6"
          sub={`${data?.monthly.length ?? 0} months`} />
        <StatCard icon={CheckCircle2} label="Completed"           value={data?.statusTotals.find(s=>s.status==="completed")?.count ?? "—"} color="#22c55e"
          sub={data ? `${completionRate}% completion rate` : undefined} />
        <StatCard icon={Building2}    label="Companies"           value={data?.companiesInvolved ?? "—"}   color="#6366f1"
          sub="with consultations" />
        <StatCard icon={Users}        label="Consultants"         value={data?.consultantsInvolved ?? "—"} color="#0ea5e9"
          sub="assigned" />
      </div>

      {/* ── Monthly trend ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Monthly Volume by Status</CardTitle>
        </CardHeader>
        <CardContent>
          {!data || data.monthly.every(m => m.total === 0) ? (
            <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">
              No consultations in this period
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.monthly} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip content={<StatusTooltip />} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
                <Legend
                  formatter={(value) => <span className="text-xs text-muted-foreground">{STATUS_LABELS[value] ?? value}</span>}
                  wrapperStyle={{ paddingTop: 12 }}
                />
                {STATUSES.map((s) => (
                  <Bar key={s} dataKey={s} stackId="a" fill={STATUS_COLORS[s]} radius={s === "archived" ? [3, 3, 0, 0] : [0, 0, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* ── Per company + per consultant + status donut ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Per company */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">By Company</CardTitle>
          </CardHeader>
          <CardContent>
            {!data || data.byCompany.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No data</div>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(180, data.byCompany.length * 32)}>
                <BarChart
                  data={data.byCompany}
                  layout="vertical"
                  margin={{ top: 0, right: 16, bottom: 0, left: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis
                    type="category" dataKey="company" width={90}
                    tick={{ fontSize: 11 }} tickLine={false} axisLine={false}
                    tickFormatter={(v: string) => v.length > 14 ? v.slice(0, 13) + "…" : v}
                  />
                  <Tooltip
                    formatter={(value, name) => [value, STATUS_LABELS[name as string] ?? name]}
                    cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                  />
                  {STATUSES.filter(s => data.byCompany.some(c => (c[s as keyof typeof c] as number) > 0)).map((s) => (
                    <Bar key={s} dataKey={s} stackId="a" fill={STATUS_COLORS[s]}
                      radius={s === "archived" ? [0, 3, 3, 0] : [0, 0, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Per consultant */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">By Consultant</CardTitle>
          </CardHeader>
          <CardContent>
            {!data || data.byConsultant.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
                No consultant assignments
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(180, data.byConsultant.length * 32)}>
                <BarChart
                  data={data.byConsultant}
                  layout="vertical"
                  margin={{ top: 0, right: 16, bottom: 0, left: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis
                    type="category" dataKey="name" width={90}
                    tick={{ fontSize: 11 }} tickLine={false} axisLine={false}
                    tickFormatter={(v: string) => v.length > 14 ? v.slice(0, 13) + "…" : v}
                  />
                  <Tooltip formatter={(value) => [value, "Consultations"]} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
                  <Bar dataKey="total" fill={CONSULTANT_COLOR} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Status donut */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {!data || data.total === 0 ? (
              <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No data</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={data.statusTotals.filter(s => s.count > 0)}
                      cx="50%" cy="50%"
                      innerRadius={52} outerRadius={72}
                      dataKey="count"
                      labelLine={false}
                    >
                      {data.statusTotals.filter(s => s.count > 0).map((s) => (
                        <Cell key={s.status} fill={STATUS_COLORS[s.status]} />
                      ))}
                      <DonutCenterLabel total={data.total} />
                    </Pie>
                    <Tooltip formatter={(value, name) => [value, STATUS_LABELS[name as string] ?? name]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-1">
                  {data.statusTotals.filter(s => s.count > 0).map((s) => (
                    <div key={s.status} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="h-2 w-2 rounded-full inline-block shrink-0" style={{ background: STATUS_COLORS[s.status] }} />
                      {s.label}
                      <Badge variant="outline" className="text-[10px] h-4 px-1">{s.count}</Badge>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
