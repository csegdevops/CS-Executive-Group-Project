import { requireAuth } from "@/lib/auth-helpers"
import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/layout/PageHeader"
import { Badge } from "@/components/ui/badge"
import { notFound } from "next/navigation"
import Link from "next/link"
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  FlaskConical,
  Tag,
  FileText,
} from "lucide-react"

const FRAMEWORK_LABELS: Record<string, string> = {
  aicis: "AICIS (Australia)",
  reach: "EU REACH",
  tsca:  "TSCA (USA)",
}

const STATUS_STYLES: Record<string, string> = {
  listed:     "text-green-700 border-green-300 bg-green-50",
  restricted: "text-amber-700 border-amber-300 bg-amber-50",
  not_listed: "text-gray-600 border-gray-300 bg-gray-50",
  exempt:     "text-blue-700 border-blue-300 bg-blue-50",
  pending:    "text-yellow-700 border-yellow-300 bg-yellow-50",
  unknown:    "text-gray-500 border-gray-200",
}

export default async function ChemicalDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requireAuth()
  const { id } = await params
  const { from } = await searchParams
  const supabase = await createClient()
  const reg = supabase.schema("regulatory")

  const [chemRes, aliasRes, listingRes, consultationRes] = await Promise.all([
    reg
      .from("chemicals")
      .select("id, cas_number, iupac_name, common_name, molecular_formula, molecular_weight, inchi_key, pubchem_cid, needs_review, resolved_at, created_at")
      .eq("id", id)
      .single(),
    reg
      .from("chemical_aliases")
      .select("id, alias, alias_type, source")
      .eq("chemical_id", id)
      .order("alias_type"),
    reg
      .from("regulatory_listings")
      .select("id, framework, status, list_name, notes, last_checked, effective_date")
      .eq("chemical_id", id)
      .order("framework"),
    reg
      .from("consultation_chemicals")
      .select("consultation_id, consultations(id, title, status, reference_number, companies(id, name))")
      .eq("chemical_id", id),
  ])

  if (chemRes.error || !chemRes.data) notFound()
  const chem      = chemRes.data
  const aliases   = aliasRes.data   ?? []
  const listings  = listingRes.data ?? []
  const consultations = (consultationRes.data ?? [])
    .map((cc) => cc.consultations)
    .filter(Boolean) as {
      id: string
      title: string
      status: string
      reference_number: string | null
      companies: { id: string; name: string } | null
    }[]

  return (
    <div className="max-w-3xl space-y-6">
      {/* Back link */}
      <Link
        href={from ?? "/regulatory/chemicals"}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        {from ? "Back to Consultation" : "Chemical Catalogue"}
      </Link>

      <PageHeader
        title={chem.common_name}
        description={chem.iupac_name && chem.iupac_name !== chem.common_name ? chem.iupac_name : undefined}
      >
        {chem.needs_review ? (
          <Badge variant="outline" className="gap-1 text-amber-700 border-amber-300 bg-amber-50">
            <AlertCircle className="h-3 w-3" /> Needs review
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1 text-green-700 border-green-300 bg-green-50">
            <CheckCircle2 className="h-3 w-3" /> Resolved
          </Badge>
        )}
      </PageHeader>

      {/* Identity card */}
      <section className="border rounded-lg divide-y text-sm">
        <div className="px-4 py-3 flex items-center gap-3">
          <FlaskConical className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-medium w-36 shrink-0 text-muted-foreground">CAS Number</span>
          <span className="font-mono">{chem.cas_number ?? "—"}</span>
        </div>
        <div className="px-4 py-3 flex items-center gap-3">
          <span className="h-4 w-4 shrink-0" />
          <span className="font-medium w-36 shrink-0 text-muted-foreground">Molecular Formula</span>
          <span className="font-mono">{chem.molecular_formula ?? "—"}</span>
        </div>
        {chem.molecular_weight && (
          <div className="px-4 py-3 flex items-center gap-3">
            <span className="h-4 w-4 shrink-0" />
            <span className="font-medium w-36 shrink-0 text-muted-foreground">Molecular Weight</span>
            <span>{chem.molecular_weight} g/mol</span>
          </div>
        )}
        {chem.inchi_key && (
          <div className="px-4 py-3 flex items-start gap-3">
            <span className="h-4 w-4 shrink-0" />
            <span className="font-medium w-36 shrink-0 text-muted-foreground">InChI Key</span>
            <span className="font-mono text-xs break-all">{chem.inchi_key}</span>
          </div>
        )}
        {chem.pubchem_cid && (
          <div className="px-4 py-3 flex items-center gap-3">
            <span className="h-4 w-4 shrink-0" />
            <span className="font-medium w-36 shrink-0 text-muted-foreground">PubChem CID</span>
            <span>{chem.pubchem_cid}</span>
          </div>
        )}
      </section>

      {/* Regulatory listings */}
      <section className="space-y-2">
        <h2 className="font-semibold text-sm flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          Regulatory Status
        </h2>
        {listings.length === 0 ? (
          <p className="text-sm text-muted-foreground border rounded-lg px-4 py-6 text-center">
            No regulatory listings found for this chemical.
          </p>
        ) : (
          <div className="border rounded-lg divide-y text-sm">
            {listings.map((l) => (
              <div key={l.id} className="px-4 py-3 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{FRAMEWORK_LABELS[l.framework] ?? l.framework.toUpperCase()}</span>
                  <Badge variant="outline" className={`text-xs capitalize ${STATUS_STYLES[l.status] ?? ""}`}>
                    {l.status.replace("_", " ")}
                  </Badge>
                </div>
                {l.list_name && (
                  <p className="text-xs text-muted-foreground">{l.list_name}</p>
                )}
                {l.notes && (
                  <p className="text-xs text-muted-foreground">{l.notes}</p>
                )}
                {l.last_checked && (
                  <p className="text-xs text-muted-foreground/60">
                    Last checked {new Date(l.last_checked).toLocaleDateString()}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Aliases / known names */}
      {aliases.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold text-sm flex items-center gap-2">
            <Tag className="h-4 w-4 text-muted-foreground" />
            Known Names &amp; Identifiers
          </h2>
          <div className="flex flex-wrap gap-2">
            {aliases.map((a) => (
              <Badge key={a.id} variant="outline" className="text-xs font-normal">
                {a.alias}
                {a.alias_type && a.alias_type !== "synonym" && (
                  <span className="ml-1 text-muted-foreground opacity-60 capitalize">
                    · {a.alias_type.replace("_", " ")}
                  </span>
                )}
              </Badge>
            ))}
          </div>
        </section>
      )}

      {/* Consultations */}
      {consultations.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold text-sm flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Used in Consultations
          </h2>
          <div className="border rounded-lg divide-y text-sm">
            {consultations.map((c) => (
              <div key={c.id} className="px-4 py-3 flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{c.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.companies?.name ?? "—"}
                    {c.reference_number && ` · ${c.reference_number}`}
                  </p>
                </div>
                <Badge variant="outline" className="text-xs capitalize">
                  {c.status.replace("_", " ")}
                </Badge>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
