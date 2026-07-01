import { requireModuleAccess } from "@/lib/auth-helpers"
import { createAdminClient } from "@/lib/supabase/admin"
import { PageHeader } from "@/components/layout/PageHeader"
import Link from "next/link"
import { formatDistanceToNow } from "@/lib/date-helpers"
import { Phone, Mail, Users, FileText } from "lucide-react"

const STAGE_LABELS: Record<string, string> = {
  lead: "Lead", qualified: "Qualified", proposal: "Proposal", negotiation: "Negotiation", won: "Won", lost: "Lost",
}

const TYPE_ICONS = { call: Phone, email: Mail, meeting: Users, note: FileText } as const

export default async function CrmDashboardPage() {
  await requireModuleAccess("crm")
  const admin = createAdminClient()

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { data: opps },
    { data: recentActivities },
    { data: dormantCompanies },
    { data: companies },
  ] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin.schema("crm") as any)
      .from("opportunities")
      .select("id, title, stage, value, currency, company_id")
      .not("stage", "in", '("won","lost")'),
    admin
      .from("company_activities")
      .select("id, activity_type, subject, company_id, occurred_at, performed_by")
      .order("occurred_at", { ascending: false })
      .limit(5),
    admin
      .from("companies")
      .select("id, name, last_activity_at")
      .eq("is_active", true)
      .or(`last_activity_at.lt.${thirtyDaysAgo},last_activity_at.is.null`)
      .limit(5),
    admin.from("companies").select("id", { count: "exact", head: true }).eq("is_active", true),
  ])

  // Hydrate company names for activities
  const activityCompanyIds = [...new Set((recentActivities ?? []).map((a: { company_id: string }) => a.company_id))] as string[]
  const oppCompanyIds      = [...new Set((opps ?? []).map((o: { company_id: string }) => o.company_id))] as string[]
  const allCompanyIds      = [...new Set([...activityCompanyIds, ...oppCompanyIds])] as string[]

  const { data: companyRows } = allCompanyIds.length
    ? await admin.from("companies").select("id, name").in("id", allCompanyIds)
    : { data: [] }
  const companyMap = Object.fromEntries((companyRows ?? []).map((c: { id: string; name: string }) => [c.id, c.name]))

  // Pipeline value by stage
  const byStage: Record<string, { count: number; value: number }> = {}
  for (const o of opps ?? []) {
    if (!byStage[o.stage]) byStage[o.stage] = { count: 0, value: 0 }
    byStage[o.stage].count++
    byStage[o.stage].value += o.value ?? 0
  }
  const totalPipelineValue = (opps ?? []).reduce((sum: number, o: { value: number | null }) => sum + (o.value ?? 0), 0)

  return (
    <div>
      <PageHeader title="CRM" description="Client relationships, leads and account management" />

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total accounts",   value: (companies as unknown as { count: number } | null)?.count ?? 0 },
          { label: "Open opportunities", value: (opps ?? []).length },
          { label: "Pipeline value (AUD)", value: totalPipelineValue > 0 ? totalPipelineValue.toLocaleString() : "—" },
          { label: "Dormant accounts",   value: (dormantCompanies ?? []).length, suffix: " (30d)" },
        ].map(s => (
          <div key={s.label} className="border rounded-lg p-4">
            <p className="text-2xl font-bold">{s.value}{s.suffix ?? ""}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pipeline by stage */}
        <div className="border rounded-lg p-4">
          <h2 className="font-semibold text-sm mb-4">Pipeline by stage</h2>
          {Object.keys(byStage).length === 0 ? (
            <p className="text-sm text-muted-foreground">No open opportunities.</p>
          ) : (
            <div className="space-y-3">
              {["lead", "qualified", "proposal", "negotiation"].filter(s => byStage[s]).map(stage => (
                <div key={stage} className="flex items-center justify-between text-sm">
                  <span className="capitalize text-muted-foreground">{STAGE_LABELS[stage]}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground text-xs">{byStage[stage].count} opp{byStage[stage].count !== 1 ? "s" : ""}</span>
                    {byStage[stage].value > 0 && <span className="font-medium">AUD {byStage[stage].value.toLocaleString()}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
          <Link href="/crm/pipeline" className="text-xs text-muted-foreground hover:text-foreground mt-3 inline-block">
            View full pipeline →
          </Link>
        </div>

        {/* Recent activity */}
        <div className="border rounded-lg p-4">
          <h2 className="font-semibold text-sm mb-4">Recent activity</h2>
          {!(recentActivities?.length) ? (
            <p className="text-sm text-muted-foreground">No activities logged yet.</p>
          ) : (
            <div className="space-y-3">
              {recentActivities.map((a: Record<string, unknown>) => {
                const Icon = TYPE_ICONS[a.activity_type as keyof typeof TYPE_ICONS] ?? FileText
                return (
                  <div key={a.id as string} className="flex items-start gap-2 text-sm">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <span className="font-medium truncate block">{a.subject as string}</span>
                      <span className="text-xs text-muted-foreground">
                        {companyMap[a.company_id as string] ?? "Unknown"} · {formatDistanceToNow(a.occurred_at as string)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          <Link href="/crm/activities" className="text-xs text-muted-foreground hover:text-foreground mt-3 inline-block">
            View all activities →
          </Link>
        </div>

        {/* Dormant accounts */}
        {(dormantCompanies ?? []).length > 0 && (
          <div className="border rounded-lg p-4 border-amber-200 bg-amber-50/30">
            <h2 className="font-semibold text-sm mb-1">Accounts needing attention</h2>
            <p className="text-xs text-muted-foreground mb-3">No activity in the last 30 days</p>
            <div className="space-y-2">
              {(dormantCompanies ?? []).map((c: { id: string; name: string; last_activity_at: string | null }) => (
                <Link
                  key={c.id}
                  href={`/crm/accounts/${c.id}?tab=activity`}
                  className="flex items-center justify-between text-sm hover:underline"
                >
                  <span>{c.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {c.last_activity_at ? formatDistanceToNow(c.last_activity_at) : "Never"}
                  </span>
                </Link>
              ))}
            </div>
            <Link href="/crm/accounts" className="text-xs text-muted-foreground hover:text-foreground mt-3 inline-block">
              View all accounts →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
