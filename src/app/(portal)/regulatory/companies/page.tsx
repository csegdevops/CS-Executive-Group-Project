import { requireModuleAccess } from "@/lib/auth-helpers"
import { createAdminClient } from "@/lib/supabase/admin"
import { PageHeader } from "@/components/layout/PageHeader"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Plus } from "lucide-react"
import { formatDistanceToNow } from "@/lib/date-helpers"
import { CrmStatusBadge } from "@/components/crm/CrmStatusBadge"

export default async function CompaniesPage() {
  await requireModuleAccess("regulatory")
  const admin = createAdminClient()
  const reg   = admin.schema("regulatory")

  // Fetch all companies
  const { data: companies } = await admin
    .from("companies")
    .select("id, name, country, industry, is_active, crm_status, account_owner_id, last_activity_at")
    .order("name")

  const companyIds = (companies ?? []).map((c) => c.id)

  // Active consultations count per company
  const { data: consultations } = companyIds.length
    ? await reg
        .from("consultations")
        .select("id, company_id, status")
        .in("company_id", companyIds)
        .in("status", ["draft", "in_progress", "under_review"])
    : { data: [] }

  const activeByCompany = new Map<string, number>()
  for (const c of consultations ?? []) {
    activeByCompany.set(c.company_id, (activeByCompany.get(c.company_id) ?? 0) + 1)
  }

  // Open opportunity counts per company
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

  // Account owner names
  const ownerIds = [...new Set((companies ?? []).map((c) => c.account_owner_id).filter(Boolean))] as string[]
  const { data: profiles } = ownerIds.length
    ? await admin.from("profiles").select("id, full_name").in("id", ownerIds)
    : { data: [] }
  const profileMap = Object.fromEntries((profiles ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name]))

  return (
    <div>
      <PageHeader
        title="Companies"
        description="Client companies — create a consultation to start an assessment"
      />

      {!(companies?.length) ? (
        <div className="border rounded-lg text-center py-16 text-muted-foreground text-sm">
          No companies found.
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Company</th>
                <th className="text-left px-4 py-3 font-medium">Country</th>
                <th className="text-left px-4 py-3 font-medium">Industry</th>
                <th className="text-left px-4 py-3 font-medium">Active Consultations</th>
                <th className="text-left px-4 py-3 font-medium">CRM Status</th>
                <th className="text-left px-4 py-3 font-medium">Owner</th>
                <th className="text-left px-4 py-3 font-medium">Last Activity</th>
                <th className="text-left px-4 py-3 font-medium">Open Opps</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {(companies ?? []).map((c) => (
                <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/regulatory/companies/${c.id}`} className="font-medium hover:underline">{c.name}</Link>
                    {!c.is_active && (
                      <Badge variant="outline" className="text-xs text-muted-foreground mt-0.5">
                        Inactive
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.country ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.industry ?? "—"}</td>
                  <td className="px-4 py-3">
                    {(activeByCompany.get(c.id) ?? 0) > 0 ? (
                      <Badge variant="outline" className="text-xs text-blue-700 border-blue-300 bg-blue-50">
                        {activeByCompany.get(c.id)} active
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">None</span>
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
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/regulatory/consultations/new?company_id=${c.id}`}>
                        <Plus className="h-4 w-4 mr-1.5" />
                        New Consultation
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
