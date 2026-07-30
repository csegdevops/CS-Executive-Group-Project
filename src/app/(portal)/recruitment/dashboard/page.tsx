import { requireModuleAccess } from "@/lib/auth-helpers"
import { createAdminClient } from "@/lib/supabase/admin"
import { PageHeader } from "@/components/layout/PageHeader"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Briefcase, Users, TrendingUp, ListChecks, Shield, Phone, Mail, FileText } from "lucide-react"
import { CrmStatusBadge } from "@/components/crm/CrmStatusBadge"
import { getCrmSummary } from "@/lib/crm/summary"
import { formatDistanceToNow } from "@/lib/date-helpers"

const STAGE_LABELS: Record<string, string> = {
  applied: "Applied", screening: "Screening", shortlisted: "Shortlisted",
  interview_1: "Interview 1", interview_2: "Interview 2",
  reference_check: "Ref Check", offer: "Offer", placed: "Placed",
}

const STAGE_COLORS: Record<string, string> = {
  applied: "bg-slate-100 text-slate-700", screening: "bg-blue-50 text-blue-700",
  shortlisted: "bg-indigo-50 text-indigo-700", interview_1: "bg-violet-50 text-violet-700",
  interview_2: "bg-purple-50 text-purple-700", reference_check: "bg-amber-50 text-amber-700",
  offer: "bg-orange-50 text-orange-700", placed: "bg-green-50 text-green-700",
}

const STATUS_COLORS: Record<string, string> = {
  opened: "bg-slate-100 text-slate-700", posted: "bg-blue-50 text-blue-700",
  active: "bg-green-50 text-green-700", paused: "bg-amber-50 text-amber-700",
  filled: "bg-purple-50 text-purple-700", closed: "bg-red-50 text-red-600",
}

const OPP_STAGE_LABELS: Record<string, string> = {
  lead: "Lead", qualified: "Qualified", proposal: "Proposal", negotiation: "Negotiation", won: "Won", lost: "Lost",
}

const ACTIVITY_TYPE_ICONS = { call: Phone, email: Mail, meeting: Users, note: FileText } as const

export default async function RecruitmentDashboard() {
  await requireModuleAccess("recruitment")
  const admin = createAdminClient()

  const [{ data: jobs }, { data: applications }, { data: candidates }, { data: tasks }, { data: recentApps }, crmSummary, { data: recentActivities }] =
    await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (admin.schema("recruitment") as any)
        .from("jobs")
        .select("id, title, reference_number, status, company_id, security_clearance_required, created_at")
        .in("status", ["opened", "posted", "active", "paused"])
        .order("created_at", { ascending: false })
        .limit(50),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (admin.schema("recruitment") as any)
        .from("applications")
        .select("id, stage, created_at")
        .not("stage", "in", '("placed","withdrawn","rejected")'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (admin.schema("recruitment") as any).from("candidates").select("id").eq("is_active", true),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (admin.schema("recruitment") as any)
        .from("tasks")
        .select("id")
        .eq("status", "open"),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (admin.schema("recruitment") as any)
        .from("applications")
        .select("id, job_id, candidate_id, stage, created_at")
        .order("created_at", { ascending: false })
        .limit(8),
      getCrmSummary(admin),
      admin
        .from("company_activities")
        .select("id, activity_type, subject, company_id, occurred_at, performed_by")
        .order("occurred_at", { ascending: false })
        .limit(5),
    ])

  const stageCounts: Record<string, number> = {}
  for (const a of (applications ?? [])) {
    stageCounts[a.stage] = (stageCounts[a.stage] ?? 0) + 1
  }

  const candIds = [...new Set((recentApps ?? []).map((a: { candidate_id: string }) => a.candidate_id))] as string[]
  const jobIds  = [...new Set((recentApps ?? []).map((a: { job_id: string }) => a.job_id))] as string[]
  const compIds = [...new Set((jobs ?? []).map((j: { company_id: string }) => j.company_id))] as string[]
  const activityCompanyIds = [...new Set((recentActivities ?? []).map((a: { company_id: string }) => a.company_id))] as string[]
  const allCompIds = [...new Set([...compIds, ...activityCompanyIds])]

  const [{ data: recCands }, { data: recJobs }, { data: companies }] = await Promise.all([
    candIds.length
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? (admin.schema("recruitment") as any).from("candidates").select("id, first_name, last_name").in("id", candIds)
      : Promise.resolve({ data: [] }),
    jobIds.length
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? (admin.schema("recruitment") as any).from("jobs").select("id, title").in("id", jobIds)
      : Promise.resolve({ data: [] }),
    allCompIds.length
      ? admin.from("companies").select("id, name, crm_status").in("id", allCompIds)
      : Promise.resolve({ data: [] }),
  ])

  const candMap    = Object.fromEntries((recCands ?? []).map((c: Record<string, unknown>) => [c.id, c]))
  const jobMap     = Object.fromEntries((recJobs ?? []).map((j: Record<string, unknown>) => [j.id, j]))
  const companyMap = Object.fromEntries((companies ?? []).map((c: { id: string; name: string; crm_status: string | null }) => [c.id, c]))

  const pipeline = ["applied", "screening", "shortlisted", "interview_1", "interview_2", "reference_check", "offer"]
  const maxCount = stageCounts["applied"] ?? 1

  const { dormantAccounts, pipelineByStage, pipelineValueAud } = crmSummary

  return (
    <div>
      <PageHeader title="Recruitment" description="Jobs, candidates, and client relationships in one place." />

      {/* Stats — ATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        {[
          { label: "Active Jobs",  value: jobs?.length ?? 0,       icon: Briefcase,  href: "/recruitment/jobs" },
          { label: "In Pipeline",  value: applications?.length ?? 0, icon: TrendingUp, href: "/recruitment/applications" },
          { label: "Candidates",   value: candidates?.length ?? 0,  icon: Users,      href: "/recruitment/candidates" },
          { label: "Open Tasks",   value: tasks?.length ?? 0,       icon: ListChecks, href: "/recruitment/tasks" },
        ].map(stat => (
          <Link key={stat.label} href={stat.href} className="rounded-lg border bg-card p-4 hover:bg-muted/20 transition-colors">
            <div className="flex items-center gap-2 mb-1">
              <stat.icon className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
            <p className="text-2xl font-semibold">{stat.value}</p>
          </Link>
        ))}
      </div>

      {/* Stats — Business Development */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total Accounts",     value: crmSummary.totalActiveAccounts,               href: "/recruitment/companies" },
          { label: "Open Opportunities", value: crmSummary.openOpportunityCount,               href: "/recruitment/pipeline" },
          { label: "Pipeline Value (AUD)", value: pipelineValueAud > 0 ? pipelineValueAud.toLocaleString() : "—", href: "/recruitment/pipeline" },
          { label: "Dormant Accounts",   value: dormantAccounts.length, suffix: " (30d)",      href: "/recruitment/companies", amber: dormantAccounts.length > 0 },
        ].map(stat => (
          <Link key={stat.label} href={stat.href} className="rounded-lg border bg-card p-4 hover:bg-muted/20 transition-colors">
            <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
            <p className={cn("text-2xl font-semibold", stat.amber && "text-amber-600")}>{stat.value}{stat.suffix ?? ""}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Pipeline */}
        <div className="lg:col-span-2 rounded-lg border bg-card p-4">
          <h2 className="text-sm font-semibold mb-3">Pipeline</h2>
          <div className="space-y-2">
            {pipeline.map(stage => {
              const count = stageCounts[stage] ?? 0
              return (
                <Link key={stage} href={`/recruitment/applications?stage=${stage}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                  <p className="text-xs text-muted-foreground w-28 shrink-0">{STAGE_LABELS[stage]}</p>
                  <div className="flex-1 h-5 bg-muted/30 rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full", STAGE_COLORS[stage] ?? "bg-muted")}
                      style={{ width: `${maxCount > 0 ? Math.max((count / maxCount) * 100, count > 0 ? 4 : 0) : 0}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium w-6 text-right">{count}</span>
                </Link>
              )
            })}
          </div>
        </div>

        {/* Active jobs */}
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Active Jobs</h2>
            <Link href="/recruitment/jobs" className="text-xs text-primary hover:underline">All jobs</Link>
          </div>
          <div className="space-y-2">
            {(jobs ?? []).slice(0, 6).map((j: Record<string, unknown>) => (
              <Link key={j.id as string} href={`/recruitment/jobs/${j.id}`} className="block hover:bg-muted/30 rounded px-2 py-1.5 -mx-2 transition-colors">
                <div className="flex items-center gap-1.5">
                  {!!j.security_clearance_required && <Shield className="h-3 w-3 text-amber-400 shrink-0" />}
                  <p className="text-sm truncate">{j.title as string}</p>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs text-muted-foreground truncate flex-1">
                    {(companyMap[j.company_id as string] as { name: string } | undefined)?.name ?? ""}
                  </p>
                  <CrmStatusBadge status={(companyMap[j.company_id as string] as { crm_status: string | null } | undefined)?.crm_status ?? null} />
                  <Badge variant="outline" className={cn("text-xs capitalize", STATUS_COLORS[j.status as string] ?? "")}>
                    {j.status as string}
                  </Badge>
                </div>
              </Link>
            ))}
            {!jobs?.length && <p className="text-sm text-muted-foreground">No active jobs.</p>}
          </div>
        </div>
      </div>

      {/* Recent applications */}
      <div className="rounded-lg border bg-card p-4 mt-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Recent Applications</h2>
          <Link href="/recruitment/applications" className="text-xs text-primary hover:underline">All applications</Link>
        </div>
        {!(recentApps?.length) ? (
          <p className="text-sm text-muted-foreground">No applications yet.</p>
        ) : (
          <div className="divide-y">
            {(recentApps ?? []).map((a: Record<string, unknown>) => {
              const cand = candMap[a.candidate_id as string] as Record<string, unknown> | undefined
              const job  = jobMap[a.job_id as string] as Record<string, unknown> | undefined
              return (
                <Link key={a.id as string} href={`/recruitment/applications/${a.id}`} className="flex items-center gap-4 py-2.5 hover:bg-muted/20 -mx-4 px-4 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {cand ? `${cand.first_name} ${cand.last_name}` : "Unknown"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{(job?.title as string) ?? "—"}</p>
                  </div>
                  <Badge variant="outline" className={cn("text-xs shrink-0", STAGE_COLORS[a.stage as string] ?? "")}>
                    {STAGE_LABELS[a.stage as string] ?? a.stage as string}
                  </Badge>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {new Date(a.created_at as string).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-8 mb-3">Business Development</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pipeline by stage */}
        <div className="border rounded-lg p-4">
          <h3 className="font-semibold text-sm mb-4">Pipeline by stage</h3>
          {Object.keys(pipelineByStage).length === 0 ? (
            <p className="text-sm text-muted-foreground">No open opportunities.</p>
          ) : (
            <div className="space-y-3">
              {["lead", "qualified", "proposal", "negotiation"].filter(s => pipelineByStage[s]).map(stage => (
                <div key={stage} className="flex items-center justify-between text-sm">
                  <span className="capitalize text-muted-foreground">{OPP_STAGE_LABELS[stage]}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground text-xs">{pipelineByStage[stage].count} opp{pipelineByStage[stage].count !== 1 ? "s" : ""}</span>
                    {pipelineByStage[stage].value > 0 && <span className="font-medium">AUD {pipelineByStage[stage].value.toLocaleString()}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
          <Link href="/recruitment/pipeline" className="text-xs text-muted-foreground hover:text-foreground mt-3 inline-block">
            View full pipeline →
          </Link>
        </div>

        {/* Recent activity */}
        <div className="border rounded-lg p-4">
          <h3 className="font-semibold text-sm mb-4">Recent activity</h3>
          {!(recentActivities?.length) ? (
            <p className="text-sm text-muted-foreground">No activities logged yet.</p>
          ) : (
            <div className="space-y-3">
              {recentActivities.map((a: Record<string, unknown>) => {
                const Icon = ACTIVITY_TYPE_ICONS[a.activity_type as keyof typeof ACTIVITY_TYPE_ICONS] ?? FileText
                return (
                  <div key={a.id as string} className="flex items-start gap-2 text-sm">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <span className="font-medium truncate block">{a.subject as string}</span>
                      <span className="text-xs text-muted-foreground">
                        {(companyMap[a.company_id as string] as { name: string } | undefined)?.name ?? "Unknown"} · {formatDistanceToNow(a.occurred_at as string)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          <Link href="/recruitment/activities" className="text-xs text-muted-foreground hover:text-foreground mt-3 inline-block">
            View all activities →
          </Link>
        </div>

        {/* Dormant accounts */}
        {dormantAccounts.length > 0 && (
          <div className="border rounded-lg p-4 border-amber-200 bg-amber-50/30 md:col-span-2">
            <h3 className="font-semibold text-sm mb-1">Accounts needing attention</h3>
            <p className="text-xs text-muted-foreground mb-3">No activity in the last 30 days</p>
            <div className="space-y-2">
              {dormantAccounts.map((c) => (
                <Link
                  key={c.id}
                  href={`/recruitment/companies/${c.id}?tab=activity`}
                  className="flex items-center justify-between text-sm hover:underline"
                >
                  <span>{c.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {c.last_activity_at ? formatDistanceToNow(c.last_activity_at) : "Never"}
                  </span>
                </Link>
              ))}
            </div>
            <Link href="/recruitment/companies" className="text-xs text-muted-foreground hover:text-foreground mt-3 inline-block">
              View all accounts →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
