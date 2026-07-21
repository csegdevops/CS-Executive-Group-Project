import { requireAuth } from "@/lib/auth-helpers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { notFound } from "next/navigation"
import { formatDate } from "@/lib/date-helpers"
import { PrintButton } from "./PrintButton"
import type { RegulatoryFramework, RegulatoryStatus } from "@/types/database"

const frameworkLabels: Record<string, string> = { aicis: "AICIS", reach: "REACH", tsca: "TSCA" }

const statusLabels: Record<string, string> = {
  draft: "Draft", in_progress: "In Progress", under_review: "Under Review",
  completed: "Assessment Complete", archived: "Archived",
}

const regulatoryStatusLabels: Record<RegulatoryStatus, string> = {
  listed: "Listed", not_listed: "Not Listed", exempt: "Exempt",
  restricted: "Restricted", pending: "Pending", unknown: "Unknown",
}

interface RegulatoryListing {
  id: string
  framework: string
  status: string
  list_name: string | null
  notes: string | null
  list_url: string | null
  last_checked: string
}

interface ExportChemical {
  id: string
  cas_number: string | null
  common_name: string
  iupac_name: string | null
  molecular_formula: string | null
  regulatory_listings: RegulatoryListing[]
}

interface ExportConsultationChemical {
  id: string
  chemical_id: string | null
  role: string | null
  quantity: number | null
  unit: string | null
  notes: string | null
  product_name: string | null
  alt_cas: string | null
  chemicals: ExportChemical | null
}

export default async function ExportPage({
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
        id, chemical_id, role, quantity, unit, notes, product_name, alt_cas,
        chemicals(
          id, cas_number, common_name, iupac_name, molecular_formula,
          regulatory_listings(id, framework, status, list_name, notes, list_url, last_checked)
        )
      )
    `)
    .eq("id", consultationId)
    .single()

  if (!consultation) notFound()

  const { data: company } = await supabase
    .from("companies")
    .select("id, name, country")
    .eq("id", consultation.company_id)
    .single()

  const { data: products } = await supabase
    .schema("regulatory")
    .from("consultation_products")
    .select("id, product_name, units_per_year, unit_size_grams")
    .eq("consultation_id", consultationId)
    .order("product_name")

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: ccRows } = await (admin.schema("regulatory") as any)
    .from("consultation_consultants")
    .select("consultant_id")
    .eq("consultation_id", consultationId)

  const consultantIds = ((ccRows ?? []) as Array<{ consultant_id: string }>).map((r) => r.consultant_id)
  const { data: consultantProfiles } = consultantIds.length > 0
    ? await admin.from("profiles").select("id, full_name").in("id", consultantIds)
    : { data: [] }
  const consultants = (consultantProfiles ?? []) as Array<{ id: string; full_name: string | null }>

  const frameworks = (consultation.frameworks ?? []) as RegulatoryFramework[]
  const chemicals = (consultation.consultation_chemicals ?? []) as ExportConsultationChemical[]

  const exportDate = new Date().toLocaleDateString("en-AU", {
    day: "numeric", month: "long", year: "numeric",
  })

  return (
    <>
      {/* Print media: hide sidebar and use full width */}
      <style>{`
        @media print {
          @page { margin: 20mm 15mm; }
          .no-print { display: none !important; }
          body { font-size: 11pt; }
        }
      `}</style>

      {/* Controls — not printed */}
      <div className="no-print flex items-center gap-4 mb-8 pb-4 border-b">
        <PrintButton />
        <p className="text-sm text-muted-foreground">
          Use your browser&apos;s print dialog to save as PDF. Sidebar and controls are excluded from print.
        </p>
      </div>

      {/* Report content */}
      <div className="max-w-4xl space-y-8 text-sm">

        {/* Header */}
        <div className="border-b pb-6">
          <p className="text-xs text-muted-foreground mb-1">CS Executive Group — Regulatory Assessment Report</p>
          <h1 className="text-2xl font-bold mb-3">{consultation.title}</h1>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
            <span>Reference: <strong className="text-foreground">{consultation.reference_number ?? "—"}</strong></span>
            <span>Status: <strong className="text-foreground">{statusLabels[consultation.status] ?? consultation.status}</strong></span>
            {consultation.completed_at && (
              <span>Completed: <strong className="text-foreground">{formatDate(consultation.completed_at)}</strong></span>
            )}
            {consultation.due_date && (
              <span>Due: <strong className="text-foreground">{formatDate(consultation.due_date)}</strong></span>
            )}
            <span className="ml-auto text-xs">Exported {exportDate}</span>
          </div>
        </div>

        {/* Consultation details */}
        <section>
          <h2 className="text-base font-semibold mb-3 border-b pb-1">Consultation Details</h2>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2">
            <Detail label="Company" value={company?.name ?? "—"} />
            <Detail label="Country" value={company?.country ?? "—"} />
            <Detail label="Regulatory Frameworks" value={frameworks.map((f) => frameworkLabels[f] ?? f.toUpperCase()).join(", ") || "—"} />
            <Detail label="Assigned Consultants" value={consultants.map((c) => c.full_name ?? "—").join(", ") || "None assigned"} />
            {consultation.description && (
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground mb-0.5">Description</p>
                <p className="whitespace-pre-wrap">{consultation.description}</p>
              </div>
            )}
          </div>
        </section>

        {/* Chemicals & Regulatory Status */}
        <section>
          <h2 className="text-base font-semibold mb-3 border-b pb-1">Chemicals &amp; Regulatory Status</h2>
          {chemicals.length === 0 ? (
            <p className="text-muted-foreground">No chemicals recorded.</p>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-muted/40 border">
                  <th className="text-left px-3 py-2 font-medium border">Chemical</th>
                  <th className="text-left px-3 py-2 font-medium border">CAS</th>
                  <th className="text-left px-3 py-2 font-medium border">Formula</th>
                  {frameworks.map((fw) => (
                    <th key={fw} className="text-left px-3 py-2 font-medium border">
                      {frameworkLabels[fw] ?? fw.toUpperCase()}
                    </th>
                  ))}
                  <th className="text-right px-3 py-2 font-medium border">Conc %</th>
                  <th className="text-left px-3 py-2 font-medium border">Product</th>
                </tr>
              </thead>
              <tbody>
                {chemicals.map((cc) => {
                  const chem = cc.chemicals
                  if (!chem) {
                    return (
                      <tr key={cc.id} className="border">
                        <td className="px-3 py-2 border italic text-muted-foreground" colSpan={4 + frameworks.length}>
                          {cc.notes ?? "Unresolved ingredient"}
                          {cc.alt_cas && <span className="font-mono ml-2 not-italic">{cc.alt_cas}</span>}
                          <span className="ml-2 text-amber-700">[Unresolved]</span>
                        </td>
                      </tr>
                    )
                  }
                  return (
                    <tr key={cc.id} className="border">
                      <td className="px-3 py-2 border font-medium">{chem.common_name}</td>
                      <td className="px-3 py-2 border font-mono">{chem.cas_number ?? "—"}</td>
                      <td className="px-3 py-2 border font-mono">{chem.molecular_formula ?? "—"}</td>
                      {frameworks.map((fw) => {
                        const listing = (chem.regulatory_listings ?? []).find((rl) => rl.framework === fw)
                        return (
                          <td key={fw} className="px-3 py-2 border">
                            {listing
                              ? (regulatoryStatusLabels[listing.status as RegulatoryStatus] ?? listing.status)
                              : "—"}
                          </td>
                        )
                      })}
                      <td className="px-3 py-2 border text-right tabular-nums">
                        {cc.quantity !== null ? `${cc.quantity}%` : "—"}
                      </td>
                      <td className="px-3 py-2 border">{cc.product_name || "—"}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </section>

        {/* Import Volumes */}
        {(products ?? []).length > 0 && (
          <section>
            <h2 className="text-base font-semibold mb-3 border-b pb-1">Import Volumes</h2>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-muted/40 border">
                  <th className="text-left px-3 py-2 font-medium border">Product</th>
                  <th className="text-right px-3 py-2 font-medium border">Units / Year</th>
                  <th className="text-right px-3 py-2 font-medium border">Unit Size (g)</th>
                  <th className="text-right px-3 py-2 font-medium border">Annual Volume (kg)</th>
                </tr>
              </thead>
              <tbody>
                {(products ?? []).map((prod) => {
                  const annualKg =
                    prod.units_per_year && prod.unit_size_grams
                      ? (prod.units_per_year * prod.unit_size_grams) / 1000
                      : null
                  return (
                    <tr key={prod.id} className="border">
                      <td className="px-3 py-2 border font-medium">{prod.product_name}</td>
                      <td className="px-3 py-2 border text-right tabular-nums">
                        {prod.units_per_year !== null ? prod.units_per_year.toLocaleString() : "—"}
                      </td>
                      <td className="px-3 py-2 border text-right tabular-nums">
                        {prod.unit_size_grams !== null ? `${prod.unit_size_grams} g` : "—"}
                      </td>
                      <td className="px-3 py-2 border text-right tabular-nums">
                        {annualKg !== null ? `${annualKg.toFixed(2)} kg` : "—"}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </section>
        )}

        {/* Regulatory notes */}
        {chemicals.some((cc) => cc.chemicals?.regulatory_listings?.some((rl) => rl.notes)) && (
          <section>
            <h2 className="text-base font-semibold mb-3 border-b pb-1">Regulatory Notes</h2>
            <div className="space-y-2">
              {chemicals.flatMap((cc) =>
                (cc.chemicals?.regulatory_listings ?? [])
                  .filter((rl) => rl.notes)
                  .map((rl) => (
                    <div key={rl.id} className="text-xs">
                      <span className="font-medium">{cc.chemicals?.common_name}</span>
                      <span className="text-muted-foreground ml-2">({frameworkLabels[rl.framework] ?? rl.framework})</span>
                      {rl.list_name && <span className="ml-2">[{rl.list_name}]</span>}
                      <p className="mt-0.5 text-muted-foreground">{rl.notes}</p>
                    </div>
                  ))
              )}
            </div>
          </section>
        )}

        {/* Footer */}
        <div className="border-t pt-4 text-xs text-muted-foreground">
          <p>CS Executive Group — Confidential regulatory assessment document.</p>
          <p>Generated {exportDate}. Reference: {consultation.reference_number ?? consultationId}.</p>
        </div>
      </div>
    </>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  )
}
