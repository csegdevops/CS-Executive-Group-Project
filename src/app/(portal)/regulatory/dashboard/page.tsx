import { requireAuth } from "@/lib/auth-helpers"
import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { Building2, FileText, Clock } from "lucide-react"

export default async function DashboardPage() {
  const user = await requireAuth()
  const supabase = await createClient()

  // Get companies the user can access (RLS scoped)
  const { data: companies } = await supabase
    .from("companies")
    .select("id, name, country, industry")
    .eq("is_active", true)
    .order("name")

  const companyIds = (companies ?? []).map((c) => c.id)

  // Fetch consultations for those companies from regulatory schema
  const { data: consultations } = companyIds.length
    ? await supabase
        .schema("regulatory")
        .from("consultations")
        .select("id, company_id, title, status, due_date, updated_at, frameworks")
        .in("company_id", companyIds)
        .order("updated_at", { ascending: false })
    : { data: [] }

  // Group consultations by company
  const consultationsByCompany = new Map<string, typeof consultations>()
  for (const c of consultations ?? []) {
    const existing = consultationsByCompany.get(c.company_id) ?? []
    existing.push(c)
    consultationsByCompany.set(c.company_id, existing)
  }

  const totalConsultations = consultations?.length ?? 0
  const activeConsultations = (consultations ?? []).filter((c) =>
    ["in_progress", "under_review"].includes(c.status)
  ).length

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${user.full_name?.split(" ")[0] ?? "there"}`}
        description="Your regulatory consulting overview"
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Companies</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{companies?.length ?? 0}</div>
            <p className="text-xs text-muted-foreground">assigned to you</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Consultations</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeConsultations}</div>
            <p className="text-xs text-muted-foreground">in progress or under review</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Consultations</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalConsultations}</div>
            <p className="text-xs text-muted-foreground">across all companies</p>
          </CardContent>
        </Card>
      </div>

      <h2 className="text-lg font-semibold mb-4">Your Companies</h2>
      {!companies?.length ? (
        <p className="text-muted-foreground text-sm">No companies assigned yet.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {companies.map((company) => {
            const recentConsultations = [...(consultationsByCompany.get(company.id) ?? [])]
              .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
              .slice(0, 3)

            return (
              <Card key={company.id} className="flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-snug">
                      <Link
                        href={`/regulatory/admin/companies/${company.id}`}
                        className="hover:underline"
                      >
                        {company.name}
                      </Link>
                    </CardTitle>
                  </div>
                  {(company.industry || company.country) && (
                    <CardDescription className="text-xs">
                      {[company.industry, company.country].filter(Boolean).join(" · ")}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="flex-1">
                  {recentConsultations.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No consultations yet</p>
                  ) : (
                    <ul className="space-y-2">
                      {recentConsultations.map((c) => (
                        <li key={c.id} className="flex items-center justify-between gap-2">
                          <Link
                            href={`/regulatory/consultations/${c.id}`}
                            className="text-sm hover:underline truncate flex-1"
                          >
                            {c.title}
                          </Link>
                          <ConsultationStatusBadge status={c.status} />
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ConsultationStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    draft: { label: "Draft", variant: "outline" },
    in_progress: { label: "In Progress", variant: "default" },
    under_review: { label: "Under Review", variant: "secondary" },
    completed: { label: "Completed", variant: "outline" },
    archived: { label: "Archived", variant: "outline" },
  }
  const { label, variant } = map[status] ?? { label: status, variant: "outline" }
  return <Badge variant={variant} className="text-xs shrink-0">{label}</Badge>
}
