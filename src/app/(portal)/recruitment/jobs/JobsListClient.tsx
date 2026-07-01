"use client"

import { useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { Search, MapPin, Users, Shield, ChevronRight } from "lucide-react"

const STATUS_COLORS: Record<string, string> = {
  opened:  "bg-slate-100 text-slate-700 border-slate-200",
  posted:  "bg-blue-50 text-blue-700 border-blue-200",
  active:  "bg-green-50 text-green-700 border-green-200",
  paused:  "bg-amber-50 text-amber-700 border-amber-200",
  filled:  "bg-purple-50 text-purple-700 border-purple-200",
  closed:  "bg-red-50 text-red-700 border-red-200",
}

const ALL_STATUSES = ["opened", "posted", "active", "paused", "filled", "closed"] as const

interface Job {
  id: string
  title: string
  reference_number: string | null
  location: string | null
  employment_type: string | null
  status: string
  security_clearance_required: boolean
  salary_min: number | null
  salary_max: number | null
  salary_currency: string | null
  company_name: string | null
  recruiter_name: string | null
  application_count: number
  created_at: string
}

interface Props {
  jobs: Job[]
  companies: { id: string; name: string }[]
  recruiters: { id: string; name: string }[]
}

function formatSalary(min: number | null, max: number | null, currency: string | null) {
  if (!min) return null
  const fmt = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(0)}k` : `$${n}`
  const c = currency ?? "AUD"
  return max && max !== min ? `${fmt(min)} – ${fmt(max)} ${c}` : `${fmt(min)} ${c}`
}

export function JobsListClient({ jobs, companies, recruiters }: Props) {
  const [q, setQ]           = useState("")
  const [status, setStatus] = useState<string>("active,posted,opened")
  const [company, setCompany] = useState("")

  const activeStatuses = status === "all" ? ALL_STATUSES : status.split(",").map(s => s.trim())

  const filtered = jobs.filter(j => {
    if (!activeStatuses.includes(j.status as typeof ALL_STATUSES[number])) return false
    if (company && j.company_name !== company) return false
    if (q) {
      const s = q.toLowerCase()
      return j.title.toLowerCase().includes(s) || (j.reference_number ?? "").toLowerCase().includes(s)
    }
    return true
  })

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search title or reference…"
            value={q}
            onChange={e => setQ(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>

        {/* Status filter chips */}
        <div className="flex items-center gap-1 flex-wrap">
          <button
            onClick={() => setStatus("active,posted,opened")}
            className={cn(
              "px-2.5 py-1 text-xs font-medium rounded-full border transition-colors",
              status === "active,posted,opened"
                ? "bg-foreground text-background border-foreground"
                : "border-border text-muted-foreground hover:border-foreground/40"
            )}
          >
            Active
          </button>
          {ALL_STATUSES.map(s => (
            <button
              key={s}
              onClick={() => setStatus(status === s ? "active,posted,opened" : s)}
              className={cn(
                "px-2.5 py-1 text-xs font-medium rounded-full border transition-colors capitalize",
                status === s
                  ? "bg-foreground text-background border-foreground"
                  : "border-border text-muted-foreground hover:border-foreground/40"
              )}
            >
              {s}
            </button>
          ))}
          {status !== "all" && (
            <button
              onClick={() => setStatus("all")}
              className="px-2.5 py-1 text-xs font-medium rounded-full border border-border text-muted-foreground hover:border-foreground/40 transition-colors"
            >
              All
            </button>
          )}
        </div>

        {/* Company filter */}
        {companies.length > 0 && (
          <select
            value={company}
            onChange={e => setCompany(e.target.value)}
            className="h-8 px-2 text-xs rounded-md border border-border bg-background text-foreground"
          >
            <option value="">All companies</option>
            {companies.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        )}
      </div>

      {/* Count */}
      <p className="text-xs text-muted-foreground mb-3">{filtered.length} job{filtered.length !== 1 ? "s" : ""}</p>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-sm text-muted-foreground border rounded-lg">
          No jobs match the current filters.
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Job</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs hidden md:table-cell">Company</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs hidden lg:table-cell">Location</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs hidden lg:table-cell">Salary</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Status</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground text-xs">Apps</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(job => (
                <tr key={job.id} className="hover:bg-muted/20 transition-colors group">
                  <td className="px-4 py-3">
                    <div className="flex items-start gap-2">
                      {job.security_clearance_required && (
                        <Shield className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" aria-label="Security clearance required" />
                      )}
                      <div>
                        <Link href={`/recruitment/jobs/${job.id}`} className="font-medium hover:underline line-clamp-1">
                          {job.title}
                        </Link>
                        <div className="flex items-center gap-2 mt-0.5">
                          {job.reference_number && (
                            <span className="text-xs text-muted-foreground font-mono">{job.reference_number}</span>
                          )}
                          {job.employment_type && (
                            <span className="text-xs text-muted-foreground capitalize">{job.employment_type}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell">
                    {job.company_name ?? "—"}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {job.location
                      ? <span className="flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-3 w-3" />{job.location}</span>
                      : <span className="text-muted-foreground/50">—</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-sm hidden lg:table-cell">
                    {formatSalary(job.salary_min, job.salary_max, job.salary_currency) ?? <span className="text-muted-foreground/50">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={cn("text-xs capitalize", STATUS_COLORS[job.status])}>
                      {job.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="flex items-center justify-end gap-1 text-sm text-muted-foreground">
                      <Users className="h-3.5 w-3.5" />
                      {job.application_count}
                    </span>
                  </td>
                  <td className="px-2 py-3">
                    <Link href={`/recruitment/jobs/${job.id}`}>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
