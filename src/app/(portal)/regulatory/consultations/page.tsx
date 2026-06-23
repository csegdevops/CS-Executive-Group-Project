import { requireAuth } from "@/lib/auth-helpers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { PageHeader } from "@/components/layout/PageHeader"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { formatDate } from "@/lib/date-helpers"
import { ConsultationsAnalytics } from "./ConsultationsAnalytics"

const STATUS_STYLES: Record<string, string> = {
  draft:        "text-gray-600 border-gray-300",
  in_progress:  "text-blue-700 border-blue-300 bg-blue-50",
  under_review: "text-amber-700 border-amber-300 bg-amber-50",
  completed:    "text-green-700 border-green-300 bg-green-50",
  archived:     "text-gray-500 border-gray-200",
}
const STATUS_LABELS: Record<string, string> = {
  draft: "Draft", in_progress: "In Progress",
  under_review: "Under Review", completed: "Completed", archived: "Archived",
}
const FRAMEWORK_LABELS: Record<string, string> = { aicis: "AICIS", reach: "REACH", tsca: "TSCA" }

export default async function ConsultationsPage() {
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

  // Admins see all consultations; members see only their assigned ones
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

  let query = admin
    .schema("regulatory")
    .from("consultations")
    .select("id, title, status, frameworks, due_date, updated_at, created_at, company_id, reference_number")
    .order("updated_at", { ascending: false })

  if (consultationIds !== null) {
    if (consultationIds.length === 0) {
      // No assignments — empty result
      return (
        <div>
          <PageHeader title="Consultations" description="Regulatory consultations you're assigned to" />
          <div className="text-center py-16 text-muted-foreground text-sm border rounded-lg">
            You have not been assigned to any consultations yet.
          </div>
        </div>
      )
    }
    query = query.in("id", consultationIds)
  }

  const { data: consultations } = await query.limit(200)

  const companyIds = [...new Set((consultations ?? []).map((c) => c.company_id))]
  const { data: companies } = companyIds.length
    ? await admin.from("companies").select("id, name").in("id", companyIds)
    : { data: [] }
  const companyMap = new Map((companies ?? []).map((c) => [c.id, c.name]))

  return (
    <div>
      <PageHeader
        title="Consultations"
        description={isAdmin ? "All regulatory consultations" : "Consultations you're assigned to"}
      />

      {/* Analytics section — admins only */}
      {isAdmin && <ConsultationsAnalytics />}

      {/* ── List ──────────────────────────────────────────────────────── */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Title</th>
              <th className="text-left px-4 py-3 font-medium">Company</th>
              <th className="text-left px-4 py-3 font-medium">Frameworks</th>
              <th className="text-left px-4 py-3 font-medium">Due</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(consultations ?? []).map((c) => (
              <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3">
                  <Link href={`/regulatory/consultations/${c.id}`} className="font-medium hover:underline">
                    {c.title}
                  </Link>
                  {c.reference_number && (
                    <p className="text-xs text-muted-foreground">{c.reference_number}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {companyMap.get(c.company_id) ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 flex-wrap">
                    {(c.frameworks ?? []).map((f: string) => (
                      <Badge key={f} variant="outline" className="text-xs">
                        {FRAMEWORK_LABELS[f] ?? f.toUpperCase()}
                      </Badge>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">
                  {formatDate(c.due_date)}
                </td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className={`text-xs ${STATUS_STYLES[c.status] ?? ""}`}>
                    {STATUS_LABELS[c.status] ?? c.status}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!(consultations?.length) && (
          <div className="text-center py-10 text-muted-foreground text-sm">
            No consultations found.
          </div>
        )}
      </div>
    </div>
  )
}
