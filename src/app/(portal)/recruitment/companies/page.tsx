import { requireModuleAccess } from "@/lib/auth-helpers"
import { createAdminClient } from "@/lib/supabase/admin"
import { PageHeader } from "@/components/layout/PageHeader"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { formatDistanceToNow } from "@/lib/date-helpers"
import { CreateCompanyDialog } from "@/app/(portal)/regulatory/admin/companies/CreateCompanyDialog"
import { CrmStatusBadge } from "@/components/crm/CrmStatusBadge"

export default async function CompaniesPage() {
  await requireModuleAccess("recruitment")
  const admin = createAdminClient()

  const { data: companies } = await admin
    .from("companies")
    .select("id, name, industry, country, crm_status, account_owner_id, last_activity_at, is_active")
    .eq("is_active", true)
    .order("name")

  const companyIds = (companies ?? []).map((c: { id: string }) => c.id)

  // Opportunity counts per company
  const { data: opps } = companyIds.length
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin.schema("recruitment") as any)
        .from("opportunities")
        .select("company_id, stage")
        .in("company_id", companyIds)
        .not("stage", "in", '("won","lost")')
    : { data: [] }

  const oppCountMap: Record<string, number> = {}
  for (const o of opps ?? []) {
    oppCountMap[o.company_id] = (oppCountMap[o.company_id] ?? 0) + 1
  }

  // Active consultations count per company
  const { data: consultations } = companyIds.length
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin.schema("regulatory") as any)
        .from("consultations")
        .select("id, company_id, status")
        .in("company_id", companyIds)
        .in("status", ["draft", "in_progress", "under_review"])
    : { data: [] }

  const activeConsultationsMap: Record<string, number> = {}
  for (const c of consultations ?? []) {
    activeConsultationsMap[c.company_id] = (activeConsultationsMap[c.company_id] ?? 0) + 1
  }

  // Open jobs count per company
  const { data: jobs } = companyIds.length
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin.schema("recruitment") as any)
        .from("jobs")
        .select("company_id, status")
        .in("company_id", companyIds)
        .not("status", "in", '("filled","closed")')
    : { data: [] }

  const openJobsCountMap: Record<string, number> = {}
  for (const j of jobs ?? []) {
    openJobsCountMap[j.company_id] = (openJobsCountMap[j.company_id] ?? 0) + 1
  }

  // Account owner names
  const ownerIds = [...new Set((companies ?? []).map((c: { account_owner_id: string | null }) => c.account_owner_id).filter(Boolean))] as string[]
  const { data: profiles } = ownerIds.length
    ? await admin.from("profiles").select("id, full_name").in("id", ownerIds)
    : { data: [] }
  const profileMap = Object.fromEntries((profiles ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name]))

  // Flag accounts needing attention: last_activity_at > 30 days or never
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  return (
    <div>
      <PageHeader title="Companies" description="All client companies — status, ownership, and activity across recruitment and business development">
        <CreateCompanyDialog />
      </PageHeader>

      {!(companies?.length) ? (
        <div className="border rounded-lg text-center py-16 text-muted-foreground text-sm">No companies found.</div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Company</th>
                <th className="text-left px-4 py-3 font-medium">CRM Status</th>
                <th className="text-left px-4 py-3 font-medium">Owner</th>
                <th className="text-left px-4 py-3 font-medium">Last Activity</th>
                <th className="text-left px-4 py-3 font-medium">Open Opportunities</th>
                <th className="text-left px-4 py-3 font-medium">Active Consultations</th>
                <th className="text-left px-4 py-3 font-medium">Open Jobs</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(companies ?? []).map((c: { id: string; name: string; industry: string | null; crm_status: string | null; account_owner_id: string | null; last_activity_at: string | null }) => {
                const needsAttention = !c.last_activity_at || c.last_activity_at < thirtyDaysAgo
                return (
                  <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/recruitment/companies/${c.id}`} className="font-medium hover:underline">{c.name}</Link>
                      {c.industry && <p className="text-xs text-muted-foreground">{c.industry}</p>}
                      {needsAttention && (
                        <span className="text-xs text-amber-600 font-medium">Needs attention</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <CrmStatusBadge status={c.crm_status} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.account_owner_id ? (profileMap[c.account_owner_id] ?? "—") : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {c.last_activity_at ? formatDistanceToNow(c.last_activity_at) : "Never"}
                    </td>
                    <td className="px-4 py-3">
                      {(oppCountMap[c.id] ?? 0) > 0 ? (
                        <Badge variant="outline" className="text-xs text-blue-700 border-blue-300 bg-blue-50">
                          {oppCountMap[c.id]}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {(activeConsultationsMap[c.id] ?? 0) > 0 ? (
                        <Badge variant="outline" className="text-xs text-blue-700 border-blue-300 bg-blue-50">
                          {activeConsultationsMap[c.id]} active
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">None</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {(openJobsCountMap[c.id] ?? 0) > 0 ? (
                        <Badge variant="outline" className="text-xs text-blue-700 border-blue-300 bg-blue-50">
                          {openJobsCountMap[c.id]}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
