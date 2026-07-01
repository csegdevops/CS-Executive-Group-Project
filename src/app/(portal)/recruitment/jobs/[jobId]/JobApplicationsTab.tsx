"use client"

import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { UserCircle, Calendar } from "lucide-react"

const STAGES = ["applied", "screening", "shortlisted", "interview_1", "interview_2", "reference_check", "offer", "placed", "withdrawn", "rejected"] as const
type Stage = typeof STAGES[number]

const STAGE_COLORS: Record<Stage, string> = {
  applied:          "bg-slate-100 text-slate-700",
  screening:        "bg-blue-50 text-blue-700",
  shortlisted:      "bg-indigo-50 text-indigo-700",
  interview_1:      "bg-violet-50 text-violet-700",
  interview_2:      "bg-purple-50 text-purple-700",
  reference_check:  "bg-amber-50 text-amber-700",
  offer:            "bg-orange-50 text-orange-700",
  placed:           "bg-green-50 text-green-700",
  withdrawn:        "bg-gray-100 text-gray-500",
  rejected:         "bg-red-50 text-red-600",
}

const STAGE_LABELS: Record<Stage, string> = {
  applied:         "Applied",
  screening:       "Screening",
  shortlisted:     "Shortlisted",
  interview_1:     "Interview 1",
  interview_2:     "Interview 2",
  reference_check: "Reference Check",
  offer:           "Offer",
  placed:          "Placed",
  withdrawn:       "Withdrawn",
  rejected:        "Rejected",
}

const SOURCE_LABELS: Record<string, string> = {
  seek_inbound:      "Seek [S]",
  company_website:   "Website [CS]",
  database_internal: "Internal [DB]",
  seek_talent:       "Seek Talent [ST]",
  linkedin:          "LinkedIn [LI]",
}

interface Candidate {
  first_name: string
  last_name: string
  email: string
  current_title: string | null
  profile_completeness_pct: number
}

interface Application {
  id: string
  candidate_id: string
  stage: string
  source_channel: string
  created_at: string
  cv_storage_key: string | null
  candidate: Candidate | null
}

export function JobApplicationsTab({ applications, jobId }: { applications: Application[]; jobId: string }) {
  if (applications.length === 0) {
    return (
      <div className="text-center py-16 text-sm text-muted-foreground border rounded-lg">
        No applications yet.{" "}
        <Link href={`/recruitment/applications`} className="underline">View all applications</Link>
      </div>
    )
  }

  // Group by active pipeline stages (exclude terminal)
  const pipeline = applications.filter(a => !["placed", "withdrawn", "rejected"].includes(a.stage))
  const terminal = applications.filter(a => ["placed", "withdrawn", "rejected"].includes(a.stage))

  return (
    <div className="space-y-6">
      {/* Stage pipeline summary */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {(["applied", "screening", "shortlisted", "interview_1", "interview_2", "reference_check", "offer"] as Stage[]).map(s => {
          const count = applications.filter(a => a.stage === s).length
          return (
            <div key={s} className={cn("rounded-lg px-3 py-2 text-center min-w-[80px] border", count > 0 ? STAGE_COLORS[s] : "bg-muted/30 text-muted-foreground border-transparent")}>
              <p className="text-lg font-semibold">{count}</p>
              <p className="text-xs whitespace-nowrap">{STAGE_LABELS[s]}</p>
            </div>
          )
        })}
      </div>

      {/* Application list */}
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Candidate</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Stage</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs hidden md:table-cell">Source</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs hidden sm:table-cell">Applied</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {[...pipeline, ...terminal].map(app => (
              <tr key={app.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3">
                  <Link href={`/recruitment/applications/${app.id}`} className="hover:underline">
                    <div className="flex items-center gap-2">
                      <UserCircle className="h-5 w-5 text-muted-foreground/40 shrink-0" />
                      <div>
                        <p className="font-medium">
                          {app.candidate ? `${app.candidate.first_name} ${app.candidate.last_name}` : "Unknown"}
                        </p>
                        {app.candidate?.current_title && (
                          <p className="text-xs text-muted-foreground">{app.candidate.current_title}</p>
                        )}
                      </div>
                    </div>
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className={cn("text-xs", STAGE_COLORS[app.stage as Stage] ?? "")}>
                    {STAGE_LABELS[app.stage as Stage] ?? app.stage}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">
                  {SOURCE_LABELS[app.source_channel] ?? app.source_channel}
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {new Date(app.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
