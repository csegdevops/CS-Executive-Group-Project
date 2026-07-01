import { requireModuleAccess } from "@/lib/auth-helpers"
import { createAdminClient } from "@/lib/supabase/admin"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, MapPin, Mail, Phone, Shield, FileText, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"
import { StageControl } from "./StageControl"

const STAGE_COLORS: Record<string, string> = {
  applied: "bg-slate-100 text-slate-700", screening: "bg-blue-50 text-blue-700",
  shortlisted: "bg-indigo-50 text-indigo-700", interview_1: "bg-violet-50 text-violet-700",
  interview_2: "bg-purple-50 text-purple-700", reference_check: "bg-amber-50 text-amber-700",
  offer: "bg-orange-50 text-orange-700", placed: "bg-green-50 text-green-700",
  withdrawn: "bg-gray-100 text-gray-500", rejected: "bg-red-50 text-red-600",
}

const PIPELINE_STAGES = ["applied", "screening", "shortlisted", "interview_1", "interview_2", "reference_check", "offer", "placed"]
const STAGE_LABELS: Record<string, string> = {
  applied: "Applied", screening: "Screening", shortlisted: "Shortlisted",
  interview_1: "Interview 1", interview_2: "Interview 2",
  reference_check: "Ref Check", offer: "Offer", placed: "Placed",
  withdrawn: "Withdrawn", rejected: "Rejected",
}

export default async function ApplicationDetailPage({ params }: { params: Promise<{ appId: string }> }) {
  await requireModuleAccess("recruitment")
  const { appId } = await params
  const admin = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: app } = await (admin.schema("recruitment") as any)
    .from("applications")
    .select("*")
    .eq("id", appId)
    .single()
  if (!app) notFound()

  const [{ data: candidate }, { data: job }, { data: history }] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin.schema("recruitment") as any)
      .from("candidates")
      .select("*")
      .eq("id", app.candidate_id)
      .single(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin.schema("recruitment") as any)
      .from("jobs")
      .select("id, title, reference_number, company_id, status, employment_type, location")
      .eq("id", app.job_id)
      .single(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin.schema("recruitment") as any)
      .from("application_stage_history")
      .select("id, from_stage, to_stage, notes, changed_by, changed_at")
      .eq("application_id", appId)
      .order("changed_at", { ascending: true }),
  ])

  const { data: company } = job
    ? await admin.from("companies").select("name").eq("id", job.company_id).single()
    : { data: null }

  // Hydrate stage history changers
  const changerIds = [...new Set((history ?? []).filter((h: { changed_by: string | null }) => h.changed_by).map((h: { changed_by: string }) => h.changed_by))]
  const { data: changers } = changerIds.length
    ? await admin.from("profiles").select("id, full_name").in("id", changerIds as string[])
    : { data: [] }
  const changerMap = Object.fromEntries((changers ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name]))

  const currentStageIdx = PIPELINE_STAGES.indexOf(app.stage)
  const isTerminal = ["withdrawn", "rejected"].includes(app.stage)

  return (
    <div className="max-w-3xl">
      <Link href="/recruitment/applications" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ChevronLeft className="h-3.5 w-3.5" />All Applications
      </Link>

      {/* Stage pipeline */}
      {!isTerminal && (
        <div className="flex items-center mb-6 overflow-x-auto py-1 px-0.5 -mx-0.5">
          {PIPELINE_STAGES.map((s, i) => {
            const done  = i < currentStageIdx
            const curr  = i === currentStageIdx
            return (
              <div key={s} className="flex items-center shrink-0">
                <div className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
                  curr  ? cn(STAGE_COLORS[s], "ring-2 ring-inset ring-current font-semibold") :
                  done  ? "bg-green-500/10 text-green-700" :
                          "bg-muted/50 text-muted-foreground"
                )}>
                  {STAGE_LABELS[s]}
                </div>
                {i < PIPELINE_STAGES.length - 1 && (
                  <div className={cn("h-px w-4 mx-1", done ? "bg-green-500/30" : "bg-border")} />
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Left: candidate + application */}
        <div className="md:col-span-2 space-y-4">
          {/* Candidate card */}
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h2 className="text-lg font-semibold">
                  {candidate ? `${candidate.first_name} ${candidate.last_name}` : "Unknown"}
                </h2>
                {candidate?.current_title && <p className="text-sm text-muted-foreground">{candidate.current_title}</p>}
                {candidate?.current_employer && <p className="text-sm text-muted-foreground">{candidate.current_employer}</p>}
              </div>
              <Link href={`/recruitment/candidates/${app.candidate_id}`} className="text-xs text-primary hover:underline">
                View profile
              </Link>
            </div>
            <div className="space-y-1">
              {candidate?.email && (
                <a href={`mailto:${candidate.email}`} className="flex items-center gap-2 text-sm hover:text-primary">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />{candidate.email}
                </a>
              )}
              {candidate?.phone && (
                <a href={`tel:${candidate.phone}`} className="flex items-center gap-2 text-sm hover:text-primary">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />{candidate.phone}
                </a>
              )}
              {(candidate?.location_city || candidate?.location_state) && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  {[candidate.location_city, candidate.location_state].filter(Boolean).join(", ")}
                </p>
              )}
              {candidate?.security_clearance_level && (
                <p className="flex items-center gap-2 text-sm">
                  <Shield className="h-3.5 w-3.5 text-amber-500" />
                  {candidate.security_clearance_level}
                  {candidate.security_clearance_verified && " ✓"}
                </p>
              )}
            </div>
            {candidate?.skills_tags?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-3">
                {candidate.skills_tags.map((tag: string) => (
                  <Badge key={tag} variant="secondary" className="text-xs">{tag.replace(/_/g, " ")}</Badge>
                ))}
              </div>
            )}
          </div>

          {/* Application info */}
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-sm">Application</h3>
              <Badge variant="outline" className={cn("text-xs", STAGE_COLORS[app.stage] ?? "")}>
                {STAGE_LABELS[app.stage] ?? app.stage}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Applied</p>
                <p>{new Date(app.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Source</p>
                <p>{({ seek_inbound: "Seek [S]", company_website: "Website [CS]", database_internal: "Internal [DB]", seek_talent: "Seek Talent [ST]", linkedin: "LinkedIn [LI]" } as Record<string, string>)[app.source_channel] ?? app.source_channel}</p>
              </div>
            </div>
            {app.cv_storage_key && (
              <a
                href={app.cv_storage_key}
                target="_blank"
                rel="noopener"
                className="flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <FileText className="h-4 w-4" />
                {app.cv_original_name ?? "Download CV"}
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {app.notes && <p className="text-sm text-muted-foreground">{app.notes}</p>}
          </div>

          {/* Stage history */}
          <div className="rounded-lg border bg-card p-4">
            <h3 className="font-medium text-sm mb-3">Stage history</h3>
            <div className="space-y-2">
              {(history ?? []).map((h: Record<string, unknown>) => (
                <div key={h.id as string} className="flex items-start gap-3 text-sm">
                  <div className="mt-1 h-2 w-2 rounded-full bg-muted-foreground/30 shrink-0" />
                  <div className="flex-1">
                    <p>
                      {h.from_stage ? `${STAGE_LABELS[h.from_stage as string] ?? h.from_stage} → ` : ""}
                      <span className="font-medium">{STAGE_LABELS[h.to_stage as string] ?? h.to_stage as string}</span>
                      {h.changed_by ? ` by ${changerMap[h.changed_by as string] ?? "Unknown"}` : ""}
                    </p>
                    {h.notes ? <p className="text-xs text-muted-foreground mt-0.5">{String(h.notes)}</p> : null}
                    <p className="text-xs text-muted-foreground">
                      {new Date(h.changed_at as string).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: job + stage control */}
        <div className="space-y-4">
          {/* Job card */}
          <div className="rounded-lg border bg-card p-4">
            <h3 className="font-medium text-sm mb-2">Job</h3>
            <Link href={`/recruitment/jobs/${app.job_id}`} className="hover:underline">
              <p className="font-medium">{job?.title ?? "Unknown"}</p>
            </Link>
            {company?.name && <p className="text-sm text-muted-foreground">{company.name}</p>}
            {job?.location && <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1"><MapPin className="h-3 w-3" />{job.location}</p>}
            {job?.employment_type && <p className="text-sm text-muted-foreground capitalize mt-1">{job.employment_type}</p>}
            {job?.reference_number && <p className="text-xs font-mono text-muted-foreground mt-1">{job.reference_number}</p>}
          </div>

          {/* Stage control */}
          <div className="rounded-lg border bg-card p-4">
            <h3 className="font-medium text-sm mb-3">Move stage</h3>
            <StageControl appId={app.id} currentStage={app.stage} />
          </div>
        </div>
      </div>
    </div>
  )
}
