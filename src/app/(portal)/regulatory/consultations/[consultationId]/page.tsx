import { requireAuth } from "@/lib/auth-helpers"
import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { PageHeader } from "@/components/layout/PageHeader"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RegulatoryStatusBadge } from "@/components/chemicals/RegulatoryStatusBadge"
import { formatDate } from "@/lib/date-helpers"
import { ChemicalsTab } from "./ChemicalsTab"
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

  const { data: consultation } = await supabase
    .schema("regulatory")
    .from("consultations")
    .select(`
      *,
      consultation_chemicals(
        id, role, quantity, unit, notes, added_at,
        chemicals(
          id, cas_number, common_name, iupac_name, molecular_formula, needs_review,
          regulatory_listings(id, framework, status, list_name, list_url, last_checked)
        )
      )
    `)
    .eq("id", consultationId)
    .single()

  if (!consultation) notFound()

  // Fetch company separately (cross-schema)
  const { data: company } = await supabase
    .from("companies")
    .select("id, name, country")
    .eq("id", consultation.company_id)
    .single()

  const consultationChemicals = consultation.consultation_chemicals ?? []

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
        </TabsList>

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
                    {(consultation.frameworks ?? []).map((f: string) => (
                      <Badge key={f} variant="outline" className="text-xs">
                        {frameworkLabels[f] ?? f.toUpperCase()}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
            {consultation.description && (
              <Card>
                <CardHeader><CardTitle className="text-sm">Description</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{consultation.description}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="chemicals">
          <ChemicalsTab
            consultationId={consultationId}
            frameworks={(consultation.frameworks ?? []) as RegulatoryFramework[]}
            initialChemicals={consultationChemicals as ConsultationChemical[]}
          />
        </TabsContent>

        <TabsContent value="regulatory">
          <div className="space-y-4">
            {consultationChemicals.length === 0 ? (
              <p className="text-muted-foreground text-sm">No chemicals added yet.</p>
            ) : (
              consultationChemicals.map((cc: ConsultationChemical) => {
                const chem = cc.chemicals
                if (!chem) return null
                return (
                  <Card key={cc.id}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">
                        {chem.common_name}
                        {chem.cas_number && (
                          <span className="ml-2 text-muted-foreground font-normal font-mono text-xs">
                            CAS {chem.cas_number}
                          </span>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {(chem.regulatory_listings ?? []).length === 0 ? (
                        <p className="text-xs text-muted-foreground">No regulatory data yet.</p>
                      ) : (
                        <div className="flex gap-2 flex-wrap">
                          {(chem.regulatory_listings ?? []).map((rl: { id: string; framework: string; status: string }) => (
                            <RegulatoryStatusBadge
                              key={rl.id}
                              framework={rl.framework as RegulatoryFramework}
                              status={rl.status as RegulatoryStatus}
                            />
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

interface ConsultationChemical {
  id: string
  role: string | null
  quantity: number | null
  unit: string | null
  notes: string | null
  added_at: string
  chemicals: {
    id: string
    cas_number: string | null
    common_name: string
    iupac_name: string | null
    molecular_formula: string | null
    needs_review: boolean
    regulatory_listings: { id: string; framework: string; status: string; list_name: string | null; list_url: string | null; last_checked: string }[]
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
