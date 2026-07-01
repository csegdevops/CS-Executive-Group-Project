"use client"

import { useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { Search, ChevronRight } from "lucide-react"

const STAGE_COLORS: Record<string, string> = {
  applied:         "bg-slate-100 text-slate-700",
  screening:       "bg-blue-50 text-blue-700",
  shortlisted:     "bg-indigo-50 text-indigo-700",
  interview_1:     "bg-violet-50 text-violet-700",
  interview_2:     "bg-purple-50 text-purple-700",
  reference_check: "bg-amber-50 text-amber-700",
  offer:           "bg-orange-50 text-orange-700",
  placed:          "bg-green-50 text-green-700",
  withdrawn:       "bg-gray-100 text-gray-500",
  rejected:        "bg-red-50 text-red-600",
}

const STAGE_LABELS: Record<string, string> = {
  applied: "Applied", screening: "Screening", shortlisted: "Shortlisted",
  interview_1: "Interview 1", interview_2: "Interview 2",
  reference_check: "Ref Check", offer: "Offer",
  placed: "Placed", withdrawn: "Withdrawn", rejected: "Rejected",
}

const STAGES = Object.keys(STAGE_LABELS)

const SOURCE_LABELS: Record<string, string> = {
  seek_inbound: "[S]", company_website: "[CS]",
  database_internal: "[DB]", seek_talent: "[ST]", linkedin: "[LI]",
}

interface App {
  id: string
  job_id: string
  candidate_id: string
  stage: string
  source_channel: string
  created_at: string
  candidate_name: string | null
  candidate_email: string | null
  candidate_title: string | null
  job_title: string | null
  job_reference: string | null
  company_name: string | null
}

interface Props {
  applications: App[]
  jobOptions: { id: string; title: string }[]
}

export function ApplicationsListClient({ applications, jobOptions }: Props) {
  const [q, setQ]           = useState("")
  const [stage, setStage]   = useState("")
  const [jobId, setJobId]   = useState("")

  const filtered = applications.filter(a => {
    if (stage && a.stage !== stage) return false
    if (jobId && a.job_id !== jobId) return false
    if (q) {
      const s = q.toLowerCase()
      return (
        (a.candidate_name ?? "").toLowerCase().includes(s) ||
        (a.candidate_email ?? "").toLowerCase().includes(s) ||
        (a.job_title ?? "").toLowerCase().includes(s)
      )
    }
    return true
  })

  // Stage summary bar
  const stageCounts = STAGES.reduce<Record<string, number>>((acc, s) => {
    acc[s] = applications.filter(a => a.stage === s).length
    return acc
  }, {})

  return (
    <div>
      {/* Stage summary */}
      <div className="flex flex-wrap gap-2 mb-4">
        {STAGES.map(s => (
          <button
            key={s}
            onClick={() => setStage(stage === s ? "" : s)}
            className={cn(
              "rounded-lg px-3 py-2 text-center min-w-[72px] transition-all shrink-0 border-b-2",
              stage === s
                ? cn(STAGE_COLORS[s], "border-current font-semibold")
                : stageCounts[s] > 0
                ? cn(STAGE_COLORS[s], "border-transparent opacity-70 hover:opacity-100")
                : "bg-muted/30 text-muted-foreground border-transparent"
            )}
          >
            <p className="text-base font-semibold">{stageCounts[s]}</p>
            <p className="text-xs whitespace-nowrap">{STAGE_LABELS[s]}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search candidate or job…"
            value={q}
            onChange={e => setQ(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        {jobOptions.length > 0 && (
          <select
            value={jobId}
            onChange={e => setJobId(e.target.value)}
            className="h-8 px-2 text-xs rounded-md border border-border bg-background"
          >
            <option value="">All jobs</option>
            {jobOptions.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
          </select>
        )}
        {(q || stage || jobId) && (
          <button
            onClick={() => { setQ(""); setStage(""); setJobId("") }}
            className="h-8 px-3 text-xs rounded-md border border-border text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        )}
      </div>

      <p className="text-xs text-muted-foreground mb-3">{filtered.length} application{filtered.length !== 1 ? "s" : ""}</p>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-sm text-muted-foreground border rounded-lg">No applications match the current filters.</div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Candidate</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs hidden md:table-cell">Job</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Stage</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs hidden sm:table-cell">Src</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs hidden lg:table-cell">Applied</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(app => (
                <tr key={app.id} className="hover:bg-muted/20 transition-colors group">
                  <td className="px-4 py-3">
                    <Link href={`/recruitment/applications/${app.id}`} className="block">
                      <p className="font-medium hover:underline">{app.candidate_name ?? "Unknown"}</p>
                      {app.candidate_title && <p className="text-xs text-muted-foreground">{app.candidate_title}</p>}
                    </Link>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <Link href={`/recruitment/jobs/${app.job_id}`} className="hover:underline text-sm">
                      {app.job_title ?? "—"}
                    </Link>
                    {app.company_name && <p className="text-xs text-muted-foreground">{app.company_name}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={cn("text-xs", STAGE_COLORS[app.stage] ?? "")}>
                      {STAGE_LABELS[app.stage] ?? app.stage}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">
                    {SOURCE_LABELS[app.source_channel] ?? app.source_channel}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell">
                    {new Date(app.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "2-digit" })}
                  </td>
                  <td className="px-2 py-3">
                    <Link href={`/recruitment/applications/${app.id}`}>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground" />
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
