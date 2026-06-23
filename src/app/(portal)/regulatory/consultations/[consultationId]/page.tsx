import { requireAuth } from "@/lib/auth-helpers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { notFound } from "next/navigation"
import { PageHeader } from "@/components/layout/PageHeader"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RegulatoryStatusBadge } from "@/components/chemicals/RegulatoryStatusBadge"
import { formatDate } from "@/lib/date-helpers"
import Link from "next/link"
import { AlertCircle } from "lucide-react"
import { ChemicalsTab } from "./ChemicalsTab"
import { VolumesTab } from "./VolumesTab"
import { LogsTab } from "./LogsTab"
import type { RegulatoryFramework, RegulatoryStatus } from "@/types/database"

const statusLabels: Record<string, string> = {
  draft: "Draft", in_progress: "In Progress", under_review: "Under Review",
  completed: "Completed", archived: "Archived",
}
const frameworkLabels: Record<string, string> = { aicis: "AICIS", reach: "REACH", tsca: "TSCA" }

export default async function ConsultationDetailPage({
  params,
}: {
  params: Promise<{ consultationId: string }>
}) {
  const { consultationId } = await params
  await requireAuth()
  const supabase = await createClient()
  const admin    = createAdminClient()

  const { data: consultation } = await supabase
    .schema("regulatory")
    .from("consultations")
    .select(`
      *,
      consultation_chemicals(
        id, chemical_id, role, quantity, unit, notes, product_name, alt_cas, added_at,
        chemicals(
          id, cas_number, common_name, iupac_name, molecular_formula, needs_review,
          regulatory_listings(id, framework, status, list_name, list_url, notes, last_checked)
        )
      )
    `)
    .eq("id", consultationId)
    .single()

  if (!consultation) notFound()

  // Company data lives in the public schema
  const { data: company } = await supabase
    .from("companies")
    .select("id, name, country")
    .eq("id", consultation.company_id)
    .single()

  // Product volume inputs for the Volumes tab
  const { data: products } = await supabase
    .schema("regulatory")
    .from("consultation_products")
    .select("id, product_name, units_per_year, unit_size_grams")
    .eq("consultation_id", consultationId)
    .order("product_name")

  // Assigned consultants — table not typed, use admin client + as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: ccRows } = await (admin.schema("regulatory") as any)
    .from("consultation_consultants")
    .select("consultant_id, assigned_at")
    .eq("consultation_id", consultationId)

  const consultantIds = ((ccRows ?? []) as Array<{ consultant_id: string }>).map((r) => r.consultant_id)
  const { data: consultantProfiles } = consultantIds.length > 0
    ? await admin.from("profiles").select("id, full_name").in("id", consultantIds)
    : { data: [] }

  const consultants = (consultantProfiles ?? []) as Array<{ id: string; full_name: string | null }>

  const consultationChemicals = (consultation.consultation_chemicals ?? []) as ConsultationChemical[]
  const frameworks = (consultation.frameworks ?? []) as RegulatoryFramework[]

  // Shape the chemicals into what VolumesTab needs
  const volumeChemicals = consultationChemicals
    .filter((cc) => cc.chemicals)
    .map((cc) => ({
      consultation_chemical_id: cc.id,
      chemical_id:   cc.chemicals!.id,
      chemical_name: cc.chemicals!.common_name,
      cas_number:    cc.chemicals!.cas_number,
      product_name:  cc.product_name ?? null,
      concentration: cc.quantity ?? null,
    }))

  const backUrl = encodeURIComponent(`/regulatory/consultations/${consultationId}`)

  return (
    <div>
      <PageHeader title={consultation.title}>
        <Badge variant="secondary">{statusLabels[consultation.status] ?? consultation.status}</Badge>
      </PageHeader>

      <Tabs defaultValue="overview">
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="chemicals">
            Chemicals ({consultationChemicals.length})
          </TabsTrigger>
          <TabsTrigger value="regulatory">Regulatory Status</TabsTrigger>
          <TabsTrigger value="volumes">Import Volumes</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        {/* ── Overview ── */}
        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Details</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Row label="Company" value={company?.name ?? "—"} />
                <Row label="Reference" value={consultation.reference_number ?? "—"} />
                <Row label="Status" value={statusLabels[consultation.status] ?? consultation.status} />
                <Row label="Due Date" value={formatDate(consultation.due_date)} />
                {consultation.completed_at && (
                  <Row label="Completed" value={formatDate(consultation.completed_at)} />
                )}
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Regulatory Frameworks</p>
                  <div className="flex gap-1 flex-wrap">
                    {frameworks.map((f) => (
                      <Badge key={f} variant="outline" className="text-xs">
                        {frameworkLabels[f] ?? f.toUpperCase()}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm">Assigned Consultants</CardTitle></CardHeader>
              <CardContent>
                {consultants.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No consultants assigned.</p>
                ) : (
                  <div className="flex gap-2 flex-wrap">
                    {consultants.map((c) => (
                      <Badge key={c.id} variant="secondary" className="text-xs">
                        {c.full_name ?? c.id}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {consultation.description && (
              <Card className="md:col-span-2">
                <CardHeader><CardTitle className="text-sm">Description</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{consultation.description}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ── Chemicals ── */}
        <TabsContent value="chemicals">
          <ChemicalsTab
            consultationId={consultationId}
            frameworks={frameworks}
            initialChemicals={consultationChemicals}
          />
        </TabsContent>

        {/* ── Regulatory Status (compact table) ── */}
        <TabsContent value="regulatory">
          {consultationChemicals.length === 0 ? (
            <p className="text-muted-foreground text-sm">No chemicals added yet.</p>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Chemical</th>
                    <th className="text-left px-4 py-3 font-medium">Formula</th>
                    {frameworks.map((fw) => (
                      <th key={fw} className="text-left px-3 py-3 font-medium">
                        {frameworkLabels[fw] ?? fw.toUpperCase()}
                      </th>
                    ))}
                    <th className="text-left px-4 py-3 font-medium">Conc %</th>
                    <th className="text-left px-4 py-3 font-medium">Product</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {consultationChemicals.map((cc) => {
                    const chem = cc.chemicals
                    if (!chem) {
                      return (
                        <tr key={cc.id} className="bg-amber-50/30">
                          <td className="px-4 py-3" colSpan={2 + frameworks.length + 2}>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground italic">
                              <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                              {cc.notes ?? "Unresolved ingredient"}
                              {cc.alt_cas && (
                                <span className="font-mono text-xs not-italic">{cc.alt_cas}</span>
                              )}
                              <Badge variant="outline" className="text-xs text-amber-700 border-amber-300 bg-amber-50 not-italic">
                                Unresolved
                              </Badge>
                            </div>
                          </td>
                        </tr>
                      )
                    }
                    return (
                      <tr key={cc.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <Link
                            href={`/regulatory/chemicals/${chem.id}?from=${backUrl}`}
                            className="font-medium hover:underline"
                          >
                            {chem.common_name}
                          </Link>
                          {chem.cas_number && (
                            <div className="text-xs text-muted-foreground font-mono">
                              {chem.cas_number}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {chem.molecular_formula ?? "—"}
                        </td>
                        {frameworks.map((fw) => {
                          const listing = (chem.regulatory_listings ?? []).find((rl) => rl.framework === fw)
                          return (
                            <td key={fw} className="px-3 py-3">
                              {listing ? (
                                <div title={[listing.list_name, listing.notes].filter(Boolean).join(" — ")}>
                                  <RegulatoryStatusBadge
                                    framework={fw}
                                    status={listing.status as RegulatoryStatus}
                                  />
                                  {listing.list_name && (
                                    <div className="text-xs text-muted-foreground mt-0.5 max-w-[120px] truncate">
                                      {listing.list_name}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </td>
                          )
                        })}
                        <td className="px-4 py-3 tabular-nums text-xs">
                          {cc.quantity !== null ? `${cc.quantity}%` : "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {cc.product_name ?? "—"}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* ── Import Volumes ── */}
        <TabsContent value="volumes">
          <VolumesTab
            consultationId={consultationId}
            initialProducts={(products ?? []) as Array<{
              id: string; product_name: string; units_per_year: number | null; unit_size_grams: number | null
            }>}
            chemicals={volumeChemicals}
          />
        </TabsContent>

        {/* ── Logs ── */}
        <TabsContent value="logs">
          <LogsTab consultationId={consultationId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

interface ConsultationChemical {
  id: string
  chemical_id: string | null
  role: string | null
  quantity: number | null
  unit: string | null
  notes: string | null
  product_name: string | null
  alt_cas: string | null
  added_at: string
  chemicals: {
    id: string
    cas_number: string | null
    common_name: string
    iupac_name: string | null
    molecular_formula: string | null
    needs_review: boolean
    regulatory_listings: {
      id: string
      framework: string
      status: string
      list_name: string | null
      list_url: string | null
      notes: string | null
      last_checked: string
    }[]
  } | null
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  )
}
