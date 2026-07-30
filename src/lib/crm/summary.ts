import { createAdminClient } from "@/lib/supabase/admin"

const DORMANT_WINDOW_DAYS = 30

export function isDormant(lastActivityAt: string | null): boolean {
  if (!lastActivityAt) return true
  return new Date(lastActivityAt).getTime() < Date.now() - DORMANT_WINDOW_DAYS * 24 * 60 * 60 * 1000
}

export interface CrmSummary {
  totalActiveAccounts: number
  openOpportunityCount: number
  pipelineValueAud: number
  dormantAccounts: { id: string; name: string; last_activity_at: string | null }[]
  pipelineByStage: Record<string, { count: number; value: number }>
}

export async function getCrmSummary(admin: ReturnType<typeof createAdminClient>): Promise<CrmSummary> {
  const thirtyDaysAgo = new Date(Date.now() - DORMANT_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const [
    { data: opps },
    { data: dormantCompanies },
    { count: totalActiveAccounts },
  ] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin.schema("recruitment") as any)
      .from("opportunities")
      .select("id, value, stage, company_id")
      .not("stage", "in", '("won","lost")'),
    admin
      .from("companies")
      .select("id, name, last_activity_at")
      .eq("is_active", true)
      .or(`last_activity_at.lt.${thirtyDaysAgo},last_activity_at.is.null`)
      .limit(5),
    admin.from("companies").select("id", { count: "exact", head: true }).eq("is_active", true),
  ])

  const pipelineByStage: Record<string, { count: number; value: number }> = {}
  for (const o of opps ?? []) {
    if (!pipelineByStage[o.stage]) pipelineByStage[o.stage] = { count: 0, value: 0 }
    pipelineByStage[o.stage].count++
    pipelineByStage[o.stage].value += o.value ?? 0
  }
  const pipelineValueAud = (opps ?? []).reduce((sum: number, o: { value: number | null }) => sum + (o.value ?? 0), 0)

  return {
    totalActiveAccounts: totalActiveAccounts ?? 0,
    openOpportunityCount: (opps ?? []).length,
    pipelineValueAud,
    dormantAccounts: dormantCompanies ?? [],
    pipelineByStage,
  }
}
