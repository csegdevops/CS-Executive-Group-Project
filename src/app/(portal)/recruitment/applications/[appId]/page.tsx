import { requireModuleAccess } from "@/lib/auth-helpers"
import { createAdminClient } from "@/lib/supabase/admin"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { StagePipelineStrip } from "./StagePipelineStrip"
import { CandidateSummaryCard } from "./CandidateSummaryCard"
import { ApplicationInfoCardWithPreview } from "./ApplicationInfoCardWithPreview"
import { StageHistoryTimeline } from "./StageHistoryTimeline"
import { JobSummaryCard } from "./JobSummaryCard"
import { StageControl } from "./StageControl"
import { DeleteApplicationButton } from "../DeleteApplicationButton"
import { PlacementCard } from "./PlacementCard"

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
      .select("id, first_name, last_name, email, phone, current_title, current_employer, location_city, location_state, skills_tags, security_clearance_level, security_clearance_verified")
      .eq("id", app.candidate_id)
      .single(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin.schema("recruitment") as any)
      .from("jobs")
      .select("id, title, reference_number, company_id, status, employment_type, location, vacancies_count")
      .eq("id", app.job_id)
      .single(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin.schema("recruitment") as any)
      .from("application_stage_history")
      .select("id, from_stage, to_stage, notes, changed_by, changed_at")
      .eq("application_id", appId)
      .order("changed_at", { ascending: true }),
  ])

  const changerIds = [...new Set((history ?? []).filter((h: { changed_by: string | null }) => h.changed_by).map((h: { changed_by: string }) => h.changed_by))]

  const [{ data: company }, { data: changers }] = await Promise.all([
    job
      ? admin.from("companies").select("name").eq("id", job.company_id).single()
      : Promise.resolve({ data: null }),
    changerIds.length
      ? admin.from("profiles").select("id, full_name").in("id", changerIds as string[])
      : Promise.resolve({ data: [] }),
  ])
  const changerMap = Object.fromEntries((changers ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name]))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: placement } = await (admin.schema("recruitment") as any)
    .from("placements")
    .select("id, placement_type, start_date, finish_date, pay_rate, charge_rate, currency")
    .eq("application_id", appId)
    .maybeSingle()

  const { data: contractor } = placement
    ? await admin.schema("timesheets").from("contractors").select("id").eq("placement_id", placement.id).maybeSingle()
    : { data: null }

  const { count: jobPlacedCount } = job
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin.schema("recruitment") as any)
        .from("placements")
        .select("id", { count: "exact", head: true })
        .eq("job_id", job.id)
    : { count: 0 }
  const remainingVacancies = job ? (job.vacancies_count ?? 1) - (jobPlacedCount ?? 0) : 0

  const stageHistory = (history ?? []).map((h: { id: string; from_stage: string | null; to_stage: string; notes: string | null; changed_by: string | null; changed_at: string }) => ({
    ...h,
    changer_name: h.changed_by ? changerMap[h.changed_by] ?? null : "System",
  }))

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <Link href="/recruitment/applications" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-3.5 w-3.5" />All Applications
        </Link>
        <DeleteApplicationButton applicationId={app.id} redirectTo="/recruitment/applications" />
      </div>

      <StagePipelineStrip stage={app.stage} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Left: candidate + application */}
        <div className="md:col-span-2 space-y-4">
          <CandidateSummaryCard candidate={candidate} hideSkills />
          <ApplicationInfoCardWithPreview app={app} />
          <StageHistoryTimeline history={stageHistory} />
        </div>

        {/* Right: job + stage control */}
        <div className="space-y-4">
          <JobSummaryCard job={job ? { ...job, company_name: company?.name ?? null } : null} />
          {app.stage !== "placed" && (
            <div className="rounded-lg border bg-card p-4">
              <h3 className="font-medium text-sm mb-3">Move stage</h3>
              <StageControl appId={app.id} currentStage={app.stage} />
            </div>
          )}
          <PlacementCard
            applicationId={app.id}
            jobId={app.job_id}
            jobTitle={job?.title ?? null}
            candidateId={app.candidate_id}
            candidateName={candidate ? `${candidate.first_name} ${candidate.last_name}` : "Candidate"}
            candidateEmail={candidate?.email ?? ""}
            companyId={job?.company_id ?? null}
            companyName={company?.name ?? null}
            employmentType={job?.employment_type ?? null}
            placement={placement ?? null}
            contractorId={contractor?.id ?? null}
            remainingVacancies={remainingVacancies}
          />
        </div>
      </div>
    </div>
  )
}
