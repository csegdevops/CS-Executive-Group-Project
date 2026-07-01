import { requireModuleAccess } from "@/lib/auth-helpers"
import { createAdminClient } from "@/lib/supabase/admin"
import { PageHeader } from "@/components/layout/PageHeader"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { formatDistanceToNow } from "@/lib/date-helpers"
import { cn } from "@/lib/utils"
import { CreateCompanyDialog } from "@/app/(portal)/regulatory/admin/companies/CreateCompanyDialog"

const CRM_STATUS_STYLES: Record<string, string> = {
  lead:     "bg-slate-100 text-slate-700 border-slate-200",
  prospect: "bg-blue-50  text-blue-700  border-blue-200",
  client:   "bg-green-50 text-green-700 border-green-200",
  inactive: "bg-red-50   text-red-700   border-red-200",
}

export default async function AccountsPage() {
  await requireModuleAccess("crm")
  const admin = createAdminClient()

  const { data: companies } = await admin
    .from("companies")
    .select("id, name, industry, country, crm_status, account_owner_id, last_activity_at, is_active")
    .eq("is_active", true)
    .order("name")

  const companyIds = (companies ?? []).map((c: { id: string }) => c.id)

  // Opportunity counts per company
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: opps } = companyIds.length
    ? await (admin.schema("crm") as any)
        .from("opportunities")
        .select("company_id, stage")
        .in("company_id", companyIds)
        .not("stage", "in", '("won","lost")')
    : { data: [] }

  const oppCountMap: Record<string, number> = {}
  for (const o of opps ?? []) {
    oppCountMap[o.company_id] = (oppCountMap[o.company_id] ?? 0) + 1
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
      <PageHeader title="Client Companies" description="All client companies with CRM status and engagement">
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
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Owner</th>
                <th className="text-left px-4 py-3 font-medium">Last activity</th>
                <th className="text-left px-4 py-3 font-medium">Open opps</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(companies ?? []).map((c: { id: string; name: string; industry: string | null; crm_status: string | null; account_owner_id: string | null; last_activity_at: string | null }) => {
                const needsAttention = !c.last_activity_at || c.last_activity_at < thirtyDaysAgo
                return (
                  <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/crm/accounts/${c.id}`} className="font-medium hover:underline">{c.name}</Link>
                      {c.industry && <p className="text-xs text-muted-foreground">{c.industry}</p>}
                      {needsAttention && (
                        <span className="text-xs text-amber-600 font-medium">Needs attention</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={cn("text-xs capitalize", CRM_STATUS_STYLES[c.crm_status ?? "prospect"])}>
                        {c.crm_status ?? "prospect"}
                      </Badge>
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
