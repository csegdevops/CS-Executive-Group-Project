"use client"

import { Badge } from "@/components/ui/badge"
import { FileText, TriangleAlert, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"
import { EditApplicationDialog } from "./EditApplicationDialog"

const STAGE_COLORS: Record<string, string> = {
  applied: "bg-slate-100 text-slate-700", screening: "bg-blue-50 text-blue-700",
  shortlisted: "bg-indigo-50 text-indigo-700", interview_1: "bg-violet-50 text-violet-700",
  interview_2: "bg-purple-50 text-purple-700", reference_check: "bg-amber-50 text-amber-700",
  offer: "bg-orange-50 text-orange-700", placed: "bg-green-50 text-green-700",
  withdrawn: "bg-gray-100 text-gray-500", rejected: "bg-red-50 text-red-600",
}

const STAGE_LABELS: Record<string, string> = {
  applied: "Applied", screening: "Screening", shortlisted: "Shortlisted",
  interview_1: "Interview 1", interview_2: "Interview 2",
  reference_check: "Ref Check", offer: "Offer", placed: "Placed",
  withdrawn: "Withdrawn", rejected: "Rejected",
}

const SOURCE_LABELS: Record<string, string> = {
  seek_inbound: "Seek [S]", company_website: "Website [CSEG]",
  database_internal: "Internal [DB]", seek_talent: "Seek Talent [ST]", linkedin: "LinkedIn [LI]",
}

export interface ApplicationInfo {
  id: string
  stage: string
  source_channel: string
  created_at: string
  cv_storage_key: string | null
  cv_original_name: string | null
  cl_storage_key: string | null
  cl_original_name: string | null
  notes: string | null
  source_metadata: Record<string, unknown> | null
}

interface Props {
  app: ApplicationInfo
  onPreview: (type: "cv" | "cl", fileName: string | null) => void
}

export function ApplicationInfoCard({ app, onPreview }: Props) {
  // A resume/cover-letter "delivery" mode was recorded at submission time
  // whenever a file was actually provided (see /api/applications' WordPress
  // webhook) — if that's set but the storage key never landed, the download
  // silently failed. The original URL is kept as a manual-retry fallback,
  // though it may no longer be reachable by the time anyone notices.
  const meta = app.source_metadata as {
    resume_delivery?: string | null
    cover_letter_delivery?: string | null
    resume_url?: string | null
    cover_letter_url?: string | null
  } | null
  const missingCv = !!meta?.resume_delivery && !app.cv_storage_key
  const missingCl = !!meta?.cover_letter_delivery && !app.cl_storage_key

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm">Application</h3>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={cn("text-xs", STAGE_COLORS[app.stage] ?? "")}>
            {STAGE_LABELS[app.stage] ?? app.stage}
          </Badge>
          <EditApplicationDialog
            appId={app.id}
            initialNotes={app.notes ?? ""}
            initialSourceChannel={app.source_channel}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Applied</p>
          <p>{new Date(app.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Source</p>
          <p>{SOURCE_LABELS[app.source_channel] ?? app.source_channel}</p>
        </div>
      </div>
      {(missingCv || missingCl) && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 space-y-1.5">
          <p className="flex items-center gap-1.5 text-xs font-medium text-amber-800">
            <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
            {missingCv && missingCl ? "CV and cover letter failed to download" : missingCv ? "CV failed to download" : "Cover letter failed to download"}
          </p>
          <p className="text-xs text-amber-800/80">
            A file was submitted with this application but couldn&apos;t be retrieved automatically — the candidate may need to resend it.
          </p>
          {missingCv && meta?.resume_url && (
            <a href={meta.resume_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-amber-900 hover:underline">
              Try original CV link <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {missingCl && meta?.cover_letter_url && (
            <a href={meta.cover_letter_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-amber-900 hover:underline">
              Try original cover letter link <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      )}
      {app.cv_storage_key && (
        <button
          type="button"
          onClick={() => onPreview("cv", app.cv_original_name)}
          className="flex items-center gap-2 text-sm text-primary hover:underline"
        >
          <FileText className="h-4 w-4" />
          {app.cv_original_name ?? "View CV"}
        </button>
      )}
      {app.cl_storage_key && (
        <button
          type="button"
          onClick={() => onPreview("cl", app.cl_original_name)}
          className="flex items-center gap-2 text-sm text-primary hover:underline"
        >
          <FileText className="h-4 w-4" />
          {app.cl_original_name ?? "View Cover Letter"}
        </button>
      )}
      {app.notes && <p className="text-sm text-muted-foreground">{app.notes}</p>}
    </div>
  )
}
