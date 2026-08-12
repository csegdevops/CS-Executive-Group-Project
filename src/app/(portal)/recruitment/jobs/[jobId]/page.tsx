import { requireModuleAccess } from "@/lib/auth-helpers"
import { createAdminClient } from "@/lib/supabase/admin"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { MapPin, Building2, Shield, ChevronLeft } from "lucide-react"
import { JobStatusControl } from "./JobStatusControl"
import { EditJobDialog } from "./EditJobDialog"
import { SeekPostButton } from "./SeekPostButton"
import { WordPressPostButton } from "./WordPressPostButton"
import { JobApplicationsTab } from "./JobApplicationsTab"
import { JobTimeline } from "./JobTimeline"
import { JobMatchesTab } from "./JobMatchesTab"
import { JobExecutiveSearchTab } from "./JobExecutiveSearchTab"
import { findMatchingCandidates } from "@/lib/recruitment/find-matching-candidates"
import { cn } from "@/lib/utils"

const STATUS_COLORS: Record<string, string> = {
  opened: "bg-slate-100 text-slate-700 border-slate-200",
  posted: "bg-blue-50 text-blue-700 border-blue-200",
  active: "bg-green-50 text-green-700 border-green-200",
  paused: "bg-amber-50 text-amber-700 border-amber-200",
  filled: "bg-purple-50 text-purple-700 border-purple-200",
  closed: "bg-red-50 text-red-700 border-red-200",
}

export default async function JobDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ jobId: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  await requireModuleAccess("recruitment")
  const { jobId } = await params
  const { tab = "applications" } = await searchParams

  const admin = createAdminClient()

  const [{ data: job }, { data: applications }, { data: events }, { count: placedCount }, { data: jobDocuments }] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin.schema("recruitment") as any)
      .from("jobs")
      .select("*")
      .eq("id", jobId)
      .single(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin.schema("recruitment") as any)
      .from("applications")
      .select(`
        id, candidate_id, stage, source_channel, created_at,
        cv_storage_key, cv_original_name
      `)
      .eq("job_id", jobId)
      .order("created_at", { ascending: false }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin.schema("recruitment") as any)
      .from("job_events")
      .select("id, event_type, previous_status, new_status, notes, created_at, performed_by")
      .eq("job_id", jobId)
      .order("created_at", { ascending: true }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin.schema("recruitment") as any)
      .from("placements")
      .select("id", { count: "exact", head: true })
      .eq("job_id", jobId),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin.schema("recruitment") as any)
      .from("job_documents")
      .select("id, original_name, created_at")
      .eq("job_id", jobId)
      .order("created_at", { ascending: false }),
  ])

  if (!job) notFound()

  // Hydrate company name + full companies list (for the edit dialog's disabled company field)
  const [{ data: company }, { data: companies }, { data: recruiterProfiles }, matches, { data: clearanceLookups }] = await Promise.all([
    admin.from("companies").select("id, name").eq("id", job.company_id).single(),
    admin.from("companies").select("id, name").order("name"),
    admin.from("profiles").select("id, full_name").order("full_name"),
    findMatchingCandidates(admin, jobId, job.required_skills ?? [], job.required_education_tags ?? []),
    admin.from("lookup_values").select("value, label").eq("category", "security_clearance_level"),
  ])
  const clearanceLevelLabel = (job.security_clearance_level_required as string | null)
    ? (clearanceLookups ?? []).find((l: { value: string; label: string }) => l.value === job.security_clearance_level_required)?.label
      ?? job.security_clearance_level_required
    : null

  // Hydrate candidate names for applications
  const candIds = [...new Set((applications ?? []).map((a: { candidate_id: string }) => a.candidate_id))]
  const appIds  = (applications ?? []).map((a: { id: string }) => a.id)
  const [{ data: candidates }, { data: appViews }] = await Promise.all([
    candIds.length
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? (admin.schema("recruitment") as any)
          .from("candidates")
          .select("id, first_name, last_name, email, current_title, profile_completeness_pct")
          .in("id", candIds)
      : Promise.resolve({ data: [] }),
    appIds.length
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? (admin.schema("recruitment") as any)
          .from("application_views")
          .select("application_id")
          .in("application_id", appIds)
      : Promise.resolve({ data: [] }),
  ])
  const candMap = Object.fromEntries((candidates ?? []).map((c: Record<string, unknown>) => [c.id, c]))
  const viewedAppIds = new Set((appViews ?? []).map((v: { application_id: string }) => v.application_id))

  // Hydrate event performer names
  const perfIds = [...new Set((events ?? []).map((e: { performed_by: string }) => e.performed_by))]
  const { data: performers } = perfIds.length
    ? await admin.from("profiles").select("id, full_name").in("id", perfIds as string[])
    : { data: [] }
  const perfMap = Object.fromEntries((performers ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name]))

  const enrichedApps = (applications ?? []).map((a: Record<string, unknown>) => {
    const c = candMap[a.candidate_id as string] as Record<string, unknown> | undefined
    return { ...a, candidate: c ?? null, viewed: viewedAppIds.has(a.id as string) }
  })

  const enrichedEvents = (events ?? []).map((e: Record<string, unknown>) => ({
    ...e,
    performer_name: perfMap[e.performed_by as string] ?? null,
  }))

  const seekConfigured = !!(process.env.SEEK_CLIENT_ID && process.env.SEEK_CLIENT_SECRET)
  const wordpressConfigured = !!(process.env.WORDPRESS_URL && process.env.WORDPRESS_API_USER && process.env.WORDPRESS_APP_PASSWORD)

  return (
    <div>
      {/* Back */}
      <Link href="/recruitment/jobs" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
        <ChevronLeft className="h-3.5 w-3.5" />
        All Jobs
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {job.security_clearance_required && (
              <Shield className="h-4 w-4 text-amber-500" aria-label="Security clearance required" />
            )}
            <h1 className="text-2xl font-semibold">{job.title}</h1>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
            {company?.name && (
              <Link href={`/recruitment/companies/${job.company_id}`} className="flex items-center gap-1 hover:underline">
                <Building2 className="h-3.5 w-3.5" />{company.name}
              </Link>
            )}
            {job.location && (
              <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{job.location}</span>
            )}
            {job.reference_number && (
              <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{job.reference_number}</span>
            )}
            <Badge variant="outline" className={cn("text-xs capitalize", STATUS_COLORS[job.status])}>
              {job.status}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <JobStatusControl jobId={job.id} currentStatus={job.status} />
          <EditJobDialog
            jobId={job.id}
            companies={(companies ?? []).map((c: { id: string; name: string }) => ({ id: c.id, name: c.name }))}
            recruiters={(recruiterProfiles ?? []).map((p: { id: string; full_name: string | null }) => ({ id: p.id, name: p.full_name ?? "Unknown" }))}
            initial={{
              company_id: job.company_id,
              title: job.title,
              reference_number: job.reference_number,
              location: job.location,
              employment_type: job.employment_type,
              vacancies_count: job.vacancies_count,
              salary_min: job.salary_min,
              salary_max: job.salary_max,
              contract_duration_weeks: job.contract_duration_weeks,
              security_clearance_required: job.security_clearance_required,
              security_clearance_level_required: job.security_clearance_level_required,
              right_to_work_check_required: job.right_to_work_check_required,
              right_to_work_notes: job.right_to_work_notes,
              assigned_recruiter_id: job.assigned_recruiter_id,
              description: job.description,
              requirements: job.requirements,
              required_skills: job.required_skills ?? [],
              required_education_tags: job.required_education_tags ?? [],
            }}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b mb-6">
        {["applications", "matches", "overview", "executive-search", "timeline"].map(t => (
          <Link
            key={t}
            href={`/recruitment/jobs/${jobId}?tab=${t}`}
            className={cn(
              "px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors",
              tab === t
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t === "applications" ? `Applications (${enrichedApps.length})`
              : t === "matches" ? `Matches (${matches.length})`
              : t === "executive-search" ? "Executive Search"
              : t}
          </Link>
        ))}
      </div>

      {/* Tab content */}
      {tab === "overview" && (
        <div className="max-w-2xl space-y-6">
          {/* Key details */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Employment type", value: job.employment_type ?? "—" },
              { label: "Currency", value: job.salary_currency ?? "AUD" },
              { label: "Salary min", value: job.salary_min ? `$${job.salary_min.toLocaleString()}` : "—" },
              { label: "Salary max", value: job.salary_max ? `$${job.salary_max.toLocaleString()}` : "—" },
              { label: "Security clearance", value: clearanceLevelLabel ?? "Not required" },
              { label: "Right-to-work check", value: job.right_to_work_check_required ? "Required" : "Not required" },
              { label: "Contract duration", value: job.contract_duration_weeks ? `${job.contract_duration_weeks} weeks` : "—" },
              { label: "Vacancies", value: String(job.vacancies_count ?? 1) },
              { label: "Placed", value: `${placedCount ?? 0} of ${job.vacancies_count ?? 1}` },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                <p className="text-sm capitalize">{value}</p>
              </div>
            ))}
          </div>
          {job.right_to_work_notes && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Right-to-work notes</p>
              <p className="text-sm whitespace-pre-wrap text-foreground/90">{job.right_to_work_notes}</p>
            </div>
          )}
          {job.description && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Description</p>
              <p className="text-sm whitespace-pre-wrap text-foreground/90">{job.description}</p>
            </div>
          )}
          {job.requirements && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Requirements</p>
              <p className="text-sm whitespace-pre-wrap text-foreground/90">{job.requirements}</p>
            </div>
          )}
          {(job.required_skills?.length > 0 || job.required_education_tags?.length > 0) && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Required Skills &amp; Education</p>
              <div className="flex flex-wrap gap-1.5">
                {(job.required_skills as string[] ?? []).map((s: string) => (
                  <Badge key={s} variant="secondary" className="text-xs">{s.replace(/_/g, " ")}</Badge>
                ))}
                {(job.required_education_tags as string[] ?? []).map((e: string) => (
                  <Badge key={e} variant="outline" className="text-xs">{e.replace(/_/g, " ")}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Seek section */}
          <SeekPostButton
            jobId={job.id}
            jobStatus={job.status}
            seekAdId={job.seek_ad_id ?? null}
            seekConfigured={seekConfigured}
          />

          {/* WordPress section */}
          <WordPressPostButton
            jobId={job.id}
            wpPostId={job.wp_post_id ?? null}
            wpPermalink={job.wp_permalink ?? null}
            wordpressConfigured={wordpressConfigured}
          />
        </div>
      )}

      {tab === "applications" && (
        <JobApplicationsTab applications={enrichedApps} jobId={jobId} />
      )}

      {tab === "matches" && (
        <JobMatchesTab
          jobId={jobId}
          matches={matches}
          hasRequirements={(job.required_skills?.length ?? 0) + (job.required_education_tags?.length ?? 0) > 0}
        />
      )}

      {tab === "executive-search" && (
        <JobExecutiveSearchTab
          jobId={jobId}
          isExecutiveSearch={!!job.is_executive_search}
          confidentialMode={!!job.confidential_mode}
          narrativeCopy={job.narrative_copy ?? null}
          hasHeroImage={!!job.hero_image_storage_key}
          documents={(jobDocuments ?? []) as { id: string; original_name: string | null; created_at: string }[]}
        />
      )}

      {tab === "timeline" && (
        <JobTimeline events={enrichedEvents} jobId={jobId} />
      )}
    </div>
  )
}
