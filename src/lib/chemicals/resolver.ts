import { createAdminClient } from "@/lib/supabase/admin"
import { fetchByIdentifier } from "./pubchem"
import { fetchReachStatus } from "./echa"
import type { RegulatoryFramework, RegulatoryStatus } from "@/types/database"

interface ResolveInput {
  cas?: string
  name?: string
}

export interface ResolvedChemical {
  id: string
  cas_number: string | null
  common_name: string
  needs_review: boolean
}

export async function resolveAndPersistChemical(
  input: ResolveInput,
  frameworks: RegulatoryFramework[] = []
): Promise<ResolvedChemical | null> {
  const admin = createAdminClient()
  const reg = admin.schema("regulatory")
  const identifier = (input.cas ?? input.name ?? "").trim()

  if (!identifier) {
    throw new Error("Provide a CAS number or chemical name")
  }

  // ─── 1. Cache check ────────────────────────────────────────────────────────

  if (input.cas) {
    const { data: existing } = await reg
      .from("chemicals")
      .select("id, cas_number, common_name, needs_review, resolved_at")
      .eq("cas_number", input.cas.trim())
      .single()

    if (existing?.resolved_at) {
      return {
        id: existing.id,
        cas_number: existing.cas_number,
        common_name: existing.common_name,
        needs_review: existing.needs_review,
      }
    }
  }

  // Try alias lookup
  const { data: aliasMatch } = await reg
    .from("chemical_aliases")
    .select("chemical_id, chemicals(id, cas_number, common_name, needs_review, resolved_at)")
    .ilike("alias", identifier)
    .limit(1)
    .single()

  if (aliasMatch?.chemicals && (aliasMatch.chemicals as { resolved_at: string | null }).resolved_at) {
    const c = aliasMatch.chemicals as ResolvedChemical
    return { id: c.id, cas_number: c.cas_number, common_name: c.common_name, needs_review: c.needs_review }
  }

  // ─── 2. PubChem lookup ─────────────────────────────────────────────────────

  const pubchemResult = await fetchByIdentifier(identifier)

  // ─── 3. Upsert chemical ────────────────────────────────────────────────────

  const upsertKey = pubchemResult?.casNumber
    ? { cas_number: pubchemResult.casNumber }
    : pubchemResult?.pubchemCid
    ? { pubchem_cid: pubchemResult.pubchemCid }
    : null

  let chemicalId: string

  if (!pubchemResult || !upsertKey) {
    // Not found in PubChem — caller stores as consultation-local (null chemical_id)
    return null
  } else {
    const { data: upserted, error } = await reg
      .from("chemicals")
      .upsert(
        {
          cas_number: pubchemResult.casNumber,
          iupac_name: pubchemResult.iupacName,
          common_name: pubchemResult.commonName,
          molecular_formula: pubchemResult.molecularFormula,
          molecular_weight: pubchemResult.molecularWeight,
          inchi_key: pubchemResult.inchiKey,
          pubchem_cid: pubchemResult.pubchemCid,
          needs_review: false,
          resolved_at: new Date().toISOString(),
        },
        {
          onConflict: pubchemResult.casNumber ? "cas_number" : "pubchem_cid",
          ignoreDuplicates: false,
        }
      )
      .select("id")
      .single()

    if (error || !upserted) throw new Error(`Failed to upsert chemical: ${error?.message}`)
    chemicalId = upserted.id

    // ─── 4. Bulk insert aliases ──────────────────────────────────────────────

    const aliases = [
      { chemical_id: chemicalId, alias: identifier, alias_type: "synonym" as const, source: "manual" as const },
      ...pubchemResult.synonyms.map((s) => ({
        chemical_id: chemicalId,
        alias: s,
        alias_type: /^\d{2,7}-\d{2}-\d$/.test(s.trim()) ? ("cas_rn" as const) : ("synonym" as const),
        source: "pubchem" as const,
      })),
    ]

    await reg
      .from("chemical_aliases")
      .upsert(aliases, { onConflict: "chemical_id,alias", ignoreDuplicates: true })
  }

  // ─── 5. Regulatory status ──────────────────────────────────────────────────

  for (const framework of frameworks) {
    let listing: {
      chemical_id: string
      framework: RegulatoryFramework
      status: RegulatoryStatus
      list_name: string | null
      list_url: string | null
      source: string | null
      last_checked: string
    } = {
      chemical_id: chemicalId,
      framework,
      status: "unknown" as RegulatoryStatus,
      list_name: null,
      list_url: null,
      source: "manual",
      last_checked: new Date().toISOString(),
    }

    if (framework === "reach" && pubchemResult?.casNumber) {
      const echaResult = await fetchReachStatus(pubchemResult.casNumber)
      if (echaResult) {
        listing = {
          ...listing,
          status: echaResult.status,
          list_name: echaResult.listName,
          list_url: echaResult.listUrl,
          source: "api",
        }
      }
    }

    await reg
      .from("regulatory_listings")
      .upsert(listing, { onConflict: "chemical_id,framework", ignoreDuplicates: false })
  }

  const { data: final } = await reg
    .from("chemicals")
    .select("id, cas_number, common_name, needs_review")
    .eq("id", chemicalId)
    .single()

  return {
    id: final?.id ?? chemicalId,
    cas_number: final?.cas_number ?? null,
    common_name: final?.common_name ?? identifier,
    needs_review: final?.needs_review ?? true,
  }
}
