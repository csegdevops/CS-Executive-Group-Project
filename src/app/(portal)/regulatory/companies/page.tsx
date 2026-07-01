import { requireModuleAccess } from "@/lib/auth-helpers"
import { createAdminClient } from "@/lib/supabase/admin"
import { PageHeader } from "@/components/layout/PageHeader"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Plus } from "lucide-react"

export default async function CompaniesPage() {
  await requireModuleAccess("regulatory")
  const admin = createAdminClient()
  const reg   = admin.schema("regulatory")

  // Fetch all companies
  const { data: companies } = await admin
    .from("companies")
    .select("id, name, country, industry, is_active")
    .order("name")

  // Active consultations count per company
  const companyIds = (companies ?? []).map((c) => c.id)
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
