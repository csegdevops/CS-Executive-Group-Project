import { requireModuleAccess } from "@/lib/auth-helpers"
import { createAdminClient } from "@/lib/supabase/admin"
import { PageHeader } from "@/components/layout/PageHeader"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { CreateCompanyDialog } from "@/app/(portal)/regulatory/admin/companies/CreateCompanyDialog"

export default async function RecruitmentClientsPage() {
  await requireModuleAccess("recruitment")
  const admin = createAdminClient()

  const { data: companies } = await admin
    .from("companies")
    .select("id, name, industry, is_active")
    .eq("is_active", true)
    .order("name")

  const companyIds = (companies ?? []).map((c: { id: string }) => c.id)

  // Open jobs per company (anything not filled/closed)
  const { data: jobs } = companyIds.length
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? await (admin.schema("recruitment") as any)
        .from("jobs")
        .select("company_id, status")
        .in("company_id", companyIds)
        .not("status", "in", '("filled","closed")')
    : { data: [] }

  const openJobsCountMap: Record<string, number> = {}
  for (const j of jobs ?? []) {
    openJobsCountMap[j.company_id] = (openJobsCountMap[j.company_id] ?? 0) + 1
  }

  return (
    <div>
      <PageHeader title="Clients" description="Client companies with open roles you're recruiting for">
        <CreateCompanyDialog />
      </PageHeader>

      {!(companies?.length) ? (
        <div className="border rounded-lg text-center py-16 text-muted-foreground text-sm">No clients found.</div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Client</th>
                <th className="text-left px-4 py-3 font-medium">Industry</th>
                <th className="text-left px-4 py-3 font-medium">Open jobs</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(companies ?? []).map((c: { id: string; name: string; industry: string | null }) => (
                <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/recruitment/companies/${c.id}`} className="font-medium hover:underline">{c.name}</Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.industry ?? "—"}</td>
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
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
