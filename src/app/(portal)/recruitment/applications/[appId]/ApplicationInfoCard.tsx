import { Badge } from "@/components/ui/badge"
import { FileText, ExternalLink } from "lucide-react"
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
  seek_inbound: "Seek [S]", company_website: "Website [CS]",
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
}

export function ApplicationInfoCard({ app }: { app: ApplicationInfo }) {
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
      {app.cv_storage_key && (
        <a
          href={`/api/recruitment/applications/${app.id}/cv?type=cv`}
          className="flex items-center gap-2 text-sm text-primary hover:underline"
        >
          <FileText className="h-4 w-4" />
          {app.cv_original_name ?? "Download CV"}
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
      {app.cl_storage_key && (
        <a
          href={`/api/recruitment/applications/${app.id}/cv?type=cl`}
          className="flex items-center gap-2 text-sm text-primary hover:underline"
        >
          <FileText className="h-4 w-4" />
          {app.cl_original_name ?? "Download Cover Letter"}
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
      {app.notes && <p className="text-sm text-muted-foreground">{app.notes}</p>}
    </div>
  )
}
