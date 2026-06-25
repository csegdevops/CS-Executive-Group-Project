import { requireModuleAdmin } from "@/lib/auth-helpers"
import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/layout/PageHeader"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Settings2 } from "lucide-react"
import { CreateCompanyDialog } from "./CreateCompanyDialog"

export default async function AdminCompaniesPage() {
  await requireModuleAdmin("regulatory")
  const supabase = await createClient()

  const { data: companies } = await supabase
    .from("companies")
    .select("id, name, abn, country, industry, is_active, created_at")
    .order("name")

  const companyIds = (companies ?? []).map((c) => c.id)
  const reg = supabase.schema("regulatory")

  type Consultation = { id: string; company_id: string; status: string }

  const { data: consultationsData } = companyIds.length
    ? await reg
        .from("consultations")
        .select("id, company_id, status")
        .in("company_id", companyIds)
    : { data: [] }

  const consultationsByCompany = new Map<string, Consultation[]>()
  for (const c of (consultationsData ?? []) as Consultation[]) {
    const list = consultationsByCompany.get(c.company_id) ?? []
    list.push(c)
    consultationsByCompany.set(c.company_id, list)
  }

  return (
    <div>
      <PageHeader title="Companies" description="All client companies">
        <CreateCompanyDialog />
      </PageHeader>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Company</th>
              <th className="text-left px-4 py-3 font-medium">Country</th>
              <th className="text-left px-4 py-3 font-medium">Consultations</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {(companies ?? []).map((c) => {
              const consultations = consultationsByCompany.get(c.id) ?? []
              const activeConsultations = consultations.filter(
                (cc) => ["in_progress", "under_review"].includes(cc.status)
              )

              return (
                <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium">{c.name}</div>
                    {c.abn && <div className="text-xs text-muted-foreground">ABN {c.abn}</div>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.country ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {activeConsultations.length} active / {consultations.length} total
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant="outline"
                      className={c.is_active
                        ? "text-xs text-green-700 border-green-300 bg-green-50"
                        : "text-xs text-gray-500"
                      }
                    >
                      {c.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/regulatory/admin/companies/${c.id}`}>
                        <Settings2 className="h-4 w-4 mr-1.5" />
                        Manage
                      </Link>
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!(companies?.length) && (
          <div className="text-center py-10 text-muted-foreground text-sm">No companies yet.</div>
        )}
      </div>
    </div>
  )
}
