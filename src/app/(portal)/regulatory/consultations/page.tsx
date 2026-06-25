import { requireAuth } from "@/lib/auth-helpers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Plus, FileDown } from "lucide-react"
import { ConsultationsAnalytics } from "./ConsultationsAnalytics"
import { ConsultationsListClient } from "./ConsultationsListClient"
import { TabBar } from "./TabBar"
import { Suspense } from "react"

export default async function ConsultationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  const showAnalytics = tab === "analytics"

  const user = await requireAuth()
  const supabase = await createClient()

  const isAdmin = user.role === "super_admin" || await (async () => {
    const { data } = await supabase
      .from("user_module_access")
      .select("access_level")
      .eq("user_id", user.id)
      .eq("module", "regulatory")
      .eq("access_level", "admin")
      .maybeSingle()
    return !!data
  })()

  // Analytics tab — skip heavy list queries
  if (showAnalytics && isAdmin) {
    return (
      <div>
        <PageHeader title="Consultations" description="All regulatory consultations" />
        <Suspense><TabBar isAdmin={isAdmin} /></Suspense>
        <ConsultationsAnalytics />
      </div>
    )
  }

  const admin = createAdminClient()
  let consultationIds: string[] | null = null

  if (!isAdmin) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: assigned } = await (admin.schema("regulatory") as any)
      .from("consultation_consultants")
      .select("consultation_id")
      .eq("consultant_id", user.id)
    consultationIds = (assigned ?? []).map((a: { consultation_id: string }) => a.consultation_id)
  }

  if (consultationIds !== null && consultationIds.length === 0) {
    return (
      <div>
        <PageHeader title="Consultations" description="Regulatory consultations you're assigned to" />
        <div className="text-center py-16 text-muted-foreground text-sm border rounded-lg">
          You have not been assigned to any consultations yet.
        </div>
      </div>
    )
  }

  let query = admin
    .schema("regulatory")
    .from("consultations")
    .select("id, title, status, frameworks, due_date, updated_at, created_at, company_id, reference_number")
    .order("updated_at", { ascending: false })

  if (consultationIds !== null) {
    query = query.in("id", consultationIds)
  }

  const { data: consultations } = await query.limit(200)

  const companyIds = [...new Set((consultations ?? []).map((c) => c.company_id))]
  const { data: companies } = companyIds.length
    ? await admin.from("companies").select("id, name").in("id", companyIds)
    : { data: [] }
  const companyNameById: Record<string, string> = Object.fromEntries(
    (companies ?? []).map((c) => [c.id, c.name])
  )

  // Fetch consultant assignments for the fetched consultations (for filtering)
  const consultationIdsList = (consultations ?? []).map((c) => c.id)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: ccData } = consultationIdsList.length
    ? await (admin.schema("regulatory") as any)
        .from("consultation_consultants")
        .select("consultation_id, consultant_id")
        .in("consultation_id", consultationIdsList)
    : { data: [] }

  // Fetch profiles for assigned consultants (for the dropdown)
  const consultantIds = [...new Set(
    ((ccData ?? []) as { consultant_id: string }[]).map((r) => r.consultant_id)
  )]
  const { data: consultantProfiles } = consultantIds.length
    ? await admin.from("profiles").select("id, full_name").in("id", consultantIds)
    : { data: [] }

  const consultants = (consultantProfiles ?? [])
    .map((p) => ({ id: p.id, name: p.full_name ?? "Unknown" }))
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div>
      <PageHeader
        title="Consultations"
        description={isAdmin ? "All regulatory consultations" : "Consultations you're assigned to"}
      >
        <Button asChild size="sm" variant="outline">
          <a href="/api/formulation/template" download="formulation-template.xlsx">
            <FileDown className="h-4 w-4 mr-1.5" />
            Download template
          </a>
        </Button>
        <Button asChild size="sm">
          <Link href="/regulatory/consultations/new">
            <Plus className="h-4 w-4 mr-1.5" />
            New Consultation
          </Link>
        </Button>
      </PageHeader>

      <Suspense><TabBar isAdmin={isAdmin} /></Suspense>

      <ConsultationsListClient
        consultations={consultations ?? []}
        companyNameById={companyNameById}
        companies={(companies ?? []).map((c) => ({ id: c.id, name: c.name }))}
        consultants={consultants}
        consultationConsultants={
          (ccData ?? []) as { consultation_id: string; consultant_id: string }[]
        }
        isAdmin={isAdmin}
      />
    </div>
  )
}
