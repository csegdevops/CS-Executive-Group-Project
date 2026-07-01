import { createAdminClient } from "@/lib/supabase/admin"
import { fetchByIdentifier } from "@/lib/chemicals/pubchem"
import type { PubChemResult } from "@/lib/chemicals/types"
import type { RegulatoryStatus } from "@/types/database"
import type { FormulationEntry } from "./formulation-parser"

const CHUNK = 500
const CAS_PATTERN = /^\d{2,7}-\d{2}-\d$/

export interface PreviousReview {
  consultationId: string
  title: string
  completedAt: string | null
}

export interface FormulationPreviewRow {
  rowIndex: number
  inciName: string | null
  casNumber: string | null
  altCas: string | null
  concentration: number | null
  function: string | null
  productName: string | null
  chemicalId: string | null
  resolvedName: string | null
  resolvedCas: string | null
  matchedBy: "cas" | "alt_cas" | "name" | "pubchem" | null
  aicisStatus: RegulatoryStatus | null
  aicisNotes: string | null
  needsAction: boolean
  isNew: boolean
  previouslyReviewed: PreviousReview[]
  // Non-null when PubChem found data for this entry but the chemical isn't in our DB yet.
  // Used by commitFormulationUpload to persist the chemical for future lookups.
  pubchemData: PubChemResult | null
}

export interface FormulationPreview {
  rows: FormulationPreviewRow[]
  matchedCount: number
  newCount: number
  needsActionCount: number
}

type ChemicalRecord = { id: string; common_name: string; cas_number: string | null }

export async function generateFormulationPreview(
  entries: FormulationEntry[],
  context: { consultationId: string | null; companyId?: string | null },
  onProgress?: (done: number, total: number) => Promise<void>
): Promise<FormulationPreview> {
  const { consultationId, companyId } = context
  const admin = createAdminClient()
  const reg = admin.schema("regulatory")

  // Phase 1 — Batch CAS lookup
  const uniqueCas = [
    ...new Set(entries.map((e) => e.casNumber).filter((c): c is string => Boolean(c))),
  ]
  const casMap = new Map<string, ChemicalRecord>()
  if (uniqueCas.length > 0) {
    const { data } = await reg.from("chemicals").select("id, common_name, cas_number").in("cas_number", uniqueCas)
    for (const c of data ?? []) casMap.set(c.cas_number!, c)
  }
  if (onProgress) await onProgress(1, 6)

  // Phase 2 — Batch Alt CAS lookup for entries not resolved by primary CAS
  const uniqueAltCas = [
    ...new Set(
      entries
        .filter((e) => e.altCas && !casMap.has(e.casNumber ?? "\x00"))
        .map((e) => e.altCas!)
    ),
  ]
  const altCasMap = new Map<string, ChemicalRecord>()
  if (uniqueAltCas.length > 0) {
    const { data } = await reg.from("chemicals").select("id, common_name, cas_number").in("cas_number", uniqueAltCas)
    for (const c of data ?? []) altCasMap.set(c.cas_number!, c)
  }
  if (onProgress) await onProgress(2, 6)

  // Phase 3 — Batch INCI name lookup via RPC (handles long names with commas safely)
  const unresolvedNames = [
    ...new Set(
      entries
        .filter((e) => {
          if (casMap.has(e.casNumber ?? "\x00")) return false
          if (e.altCas && altCasMap.has(e.altCas)) return false
          return Boolean(e.inciName)
        })
        .map((e) => e.inciName!)
    ),
  ]
  const aliasMap = new Map<string, ChemicalRecord>()
  for (let i = 0; i < unresolvedNames.length; i += CHUNK) {
    const { data } = await admin.rpc("match_chemicals_by_names", {
      names: unresolvedNames.slice(i, i + CHUNK),
    })
    for (const row of (data ?? []) as Array<{
      input_name: string; chemical_id: string; common_name: string; cas_number: string | null
    }>) {
      aliasMap.set(row.input_name.toLowerCase(), {
        id: row.chemical_id,
        common_name: row.common_name,
        cas_number: row.cas_number,
      })
    }
  }
  if (onProgress) await onProgress(3, 6)

  // Phase 4 — PubChem fallback: for entries still unresolved after all DB lookups,
  // call PubChem with the uploaded CAS (or INCI name) to get the canonical CAS,
  // then check that canonical CAS against the DB (covers AICIS-imported chemicals
  // and any future regulatory list where the DB CAS may differ from the uploaded value).
  // Full PubChemResult is stored so commitFormulationUpload can persist truly new chemicals.
  const unresolvedEntries = entries.filter((e) => {
    if (casMap.has(e.casNumber ?? "\x00")) return false
    if (e.altCas && altCasMap.has(e.altCas)) return false
    if (e.inciName && aliasMap.has(e.inciName.toLowerCase())) return false
    return true
  })

  const uniqueUnresolvedIds = [
    ...new Set(
      unresolvedEntries
        .map((e) => e.casNumber ?? e.inciName)
        .filter((id): id is string => Boolean(id))
    ),
  ]

  const pubchemResultMap = new Map<string, PubChemResult>() // identifier → full PubChem result
  const pubchemCasLookup = new Map<string, string>()        // identifier → canonical CAS
  for (const id of uniqueUnresolvedIds) {
    const result = await fetchByIdentifier(id)
    if (result) {
      pubchemResultMap.set(id, result)
      if (result.casNumber) pubchemCasLookup.set(id, result.casNumber)
    }
  }

  const pubchemCasNumbers = [...new Set([...pubchemCasLookup.values()])]
  const pubchemDbMap = new Map<string, ChemicalRecord>()
  if (pubchemCasNumbers.length > 0) {
    const { data } = await reg
      .from("chemicals")
      .select("id, common_name, cas_number")
      .in("cas_number", pubchemCasNumbers)
    for (const c of data ?? []) pubchemDbMap.set(c.cas_number!, c)
  }
  if (onProgress) await onProgress(4, 6)

  // Resolve each entry and collect IDs — needed for batch status + history lookups
  type IntermRow = {
    entry: FormulationEntry
    chemical: ChemicalRecord | null
    matchedBy: "cas" | "alt_cas" | "name" | "pubchem" | null
    pubchemData: PubChemResult | null
  }
  const intermRows: IntermRow[] = entries.map((entry) => {
    const byCas    = entry.casNumber ? casMap.get(entry.casNumber) : undefined
    const byAltCas = entry.altCas && !byCas ? altCasMap.get(entry.altCas) : undefined
    const byName   = !byCas && !byAltCas && entry.inciName
      ? aliasMap.get(entry.inciName.toLowerCase())
      : undefined
    const byPubchem = !byCas && !byAltCas && !byName
      ? (() => {
          const id = entry.casNumber ?? entry.inciName
          if (!id) return undefined
          const resolvedCas = pubchemCasLookup.get(id)
          return resolvedCas ? pubchemDbMap.get(resolvedCas) : undefined
        })()
      : undefined

    // pubchemData is non-null only when PubChem found the chemical but it's not in our DB yet.
    const pubchemData = !byCas && !byAltCas && !byName && !byPubchem
      ? (() => {
          const id = entry.casNumber ?? entry.inciName
          return id ? (pubchemResultMap.get(id) ?? null) : null
        })()
      : null

    const chemical = byCas ?? byAltCas ?? byName ?? byPubchem ?? null
    const matchedBy = byCas ? "cas" : byAltCas ? "alt_cas" : byName ? "name" : byPubchem ? "pubchem" : null
    return { entry, chemical, matchedBy, pubchemData }
  })

  const resolvedIds = [
    ...new Set(intermRows.filter((r) => r.chemical).map((r) => r.chemical!.id)),
  ]

  // Phase 5 — Batch AICIS regulatory status for all resolved chemicals
  const statusMap = new Map<string, { status: RegulatoryStatus; notes: string | null }>()
  for (let i = 0; i < resolvedIds.length; i += CHUNK) {
    const { data } = await reg
      .from("regulatory_listings")
      .select("chemical_id, status, notes")
      .in("chemical_id", resolvedIds.slice(i, i + CHUNK))
      .eq("framework", "aicis")
    for (const l of data ?? []) {
      statusMap.set(l.chemical_id, { status: l.status as RegulatoryStatus, notes: l.notes ?? null })
    }
  }
  if (onProgress) await onProgress(5, 6)

  // Phase 6 — Previously reviewed check: find these chemicals in other consultations
  //           for the same company (completed, in_progress, or under_review)
  const prevReviewedMap = new Map<string, PreviousReview[]>()
  if (resolvedIds.length > 0) {
    let effectiveCompanyId: string | null = companyId ?? null
    if (!effectiveCompanyId && consultationId) {
      const { data: consult } = await reg
        .from("consultations")
        .select("company_id")
        .eq("id", consultationId)
        .single()
      effectiveCompanyId = consult?.company_id ?? null
    }

    if (effectiveCompanyId) {
      for (let i = 0; i < resolvedIds.length; i += CHUNK) {
        let query = reg
          .from("consultation_chemicals")
          .select("chemical_id, consultations!inner(id, title, company_id, completed_at, status)")
          .eq("consultations.company_id", effectiveCompanyId)
          .in("chemical_id", resolvedIds.slice(i, i + CHUNK))

        if (consultationId) {
          query = query.neq("consultation_id", consultationId)
        }

        const { data: prevItems } = await query

        for (const item of (prevItems ?? []) as unknown as Array<{
          chemical_id: string
          consultations: { id: string; title: string; company_id: string; completed_at: string | null; status: string }
        }>) {
          const c = item.consultations
          if (!["completed", "in_progress", "under_review"].includes(c.status)) continue
          const existing = prevReviewedMap.get(item.chemical_id) ?? []
          if (!existing.some((x) => x.consultationId === c.id)) {
            existing.push({ consultationId: c.id, title: c.title, completedAt: c.completed_at })
          }
          prevReviewedMap.set(item.chemical_id, existing)
        }
      }
    }
  }
  if (onProgress) await onProgress(6, 6)

  // Assemble final rows
  const rows: FormulationPreviewRow[] = intermRows.map(({ entry, chemical, matchedBy, pubchemData }) => {
    const statusEntry = chemical ? (statusMap.get(chemical.id) ?? null) : null
    const aicisStatus = statusEntry?.status ?? null
    return {
      rowIndex:          entry.rowIndex,
      inciName:          entry.inciName,
      casNumber:         entry.casNumber,
      altCas:            entry.altCas,
      concentration:     entry.concentration,
      function:          entry.function,
      productName:       entry.productName,
      chemicalId:        chemical?.id ?? null,
      resolvedName:      chemical?.common_name ?? entry.inciName,
      resolvedCas:       chemical?.cas_number ?? entry.casNumber,
      matchedBy,
      aicisStatus,
      aicisNotes:        statusEntry?.notes ?? null,
      needsAction:       aicisStatus === "restricted" || !chemical,
      isNew:             !chemical,
      previouslyReviewed: chemical ? (prevReviewedMap.get(chemical.id) ?? []) : [],
      pubchemData,
    }
  })

  return {
    rows,
    matchedCount:     rows.filter((r) => !r.isNew).length,
    newCount:         rows.filter((r) => r.isNew).length,
    needsActionCount: rows.filter((r) => r.needsAction).length,
  }
}

export async function commitFormulationUpload(
  preview: FormulationPreview,
  entries: FormulationEntry[],
  selectedRowIndexes: number[],
  consultationId: string,
  onProgress?: (done: number, total: number) => Promise<void>
): Promise<{ added: number; unresolved: number; skipped: number; errors: string[] }> {
  const admin = createAdminClient()
  const reg = admin.schema("regulatory")
  const errors: string[] = []

  const selectedSet  = new Set(selectedRowIndexes)
  const entryMap     = new Map(entries.map((e) => [e.rowIndex, e]))
  const selectedRows = preview.rows.filter((r) => selectedSet.has(r.rowIndex))

  // Rows already resolved (all sources including pubchem DB-hit)
  const matchedRows     = selectedRows.filter((r) => r.chemicalId !== null)
  // PubChem found the chemical but it's new to our DB — persist at commit time
  const pubchemNewRows  = selectedRows.filter((r) => r.chemicalId === null && r.pubchemData !== null)
  // Truly unresolved — neither DB nor PubChem could identify them
  const trulyUnresolved = selectedRows.filter((r) => r.chemicalId === null && r.pubchemData === null)

  // Phase 1 — Write the uploaded identifier as an alias for pubchem-matched chemicals.
  // This ensures future uploads find them directly in DB without a PubChem round-trip.
  const aliasInserts = matchedRows
    .filter((r) => r.matchedBy === "pubchem")
    .flatMap((r) => {
      const entry = entryMap.get(r.rowIndex)!
      const uploadedId = entry.casNumber ?? entry.inciName
      if (!uploadedId || !r.chemicalId) return []
      return [{
        chemical_id: r.chemicalId,
        alias:       uploadedId,
        alias_type:  CAS_PATTERN.test(uploadedId.trim()) ? "cas_rn" as const : "synonym" as const,
        source:      "pubchem" as const,
      }]
    })
  if (aliasInserts.length > 0) {
    await reg
      .from("chemical_aliases")
      .upsert(aliasInserts, { onConflict: "chemical_id,alias", ignoreDuplicates: true })
  }
  if (onProgress) await onProgress(1, 5)

  // Phase 2 — Persist new PubChem-found chemicals to the global DB so they're available
  // for all future uploads and manual lookups without hitting PubChem again.
  const persistedChemicalMap = new Map<number, string>() // rowIndex → new chemical_id
  for (const r of pubchemNewRows) {
    const pd = r.pubchemData!
    const onConflict = pd.casNumber ? "cas_number" : "pubchem_cid"
    const { data: upserted, error } = await reg
      .from("chemicals")
      .upsert(
        {
          cas_number:        pd.casNumber,
          iupac_name:        pd.iupacName,
          common_name:       pd.commonName,
          molecular_formula: pd.molecularFormula,
          molecular_weight:  pd.molecularWeight,
          inchi_key:         pd.inchiKey,
          pubchem_cid:       pd.pubchemCid,
          needs_review:      false,
          resolved_at:       new Date().toISOString(),
        },
        { onConflict, ignoreDuplicates: false }
      )
      .select("id")
      .single()

    if (error || !upserted) {
      errors.push(`PubChem persist failed (row ${r.rowIndex}): ${error?.message}`)
      continue
    }

    const chemicalId = upserted.id
    persistedChemicalMap.set(r.rowIndex, chemicalId)

    // Write uploaded identifier + all PubChem synonyms as aliases
    const entry = entryMap.get(r.rowIndex)!
    const uploadedId = entry.casNumber ?? entry.inciName
    const synonymAliases = pd.synonyms.map((s) => ({
      chemical_id: chemicalId,
      alias:       s,
      alias_type:  CAS_PATTERN.test(s.trim()) ? "cas_rn" as const : "synonym" as const,
      source:      "pubchem" as const,
    }))
    const allAliases = [
      ...(uploadedId ? [{
        chemical_id: chemicalId,
        alias:       uploadedId,
        alias_type:  CAS_PATTERN.test(uploadedId.trim()) ? "cas_rn" as const : "synonym" as const,
        source:      "pubchem" as const,
      }] : []),
      ...synonymAliases,
    ]
    if (allAliases.length > 0) {
      await reg
        .from("chemical_aliases")
        .upsert(allAliases, { onConflict: "chemical_id,alias", ignoreDuplicates: true })
    }
  }
  if (onProgress) await onProgress(2, 5)

  // Phase 3 — Upsert all matched ingredients into consultation_chemicals.
  // Includes existing DB matches + newly persisted PubChem chemicals.
  const matchedInserts = [
    ...matchedRows.map((r) => {
      const entry = entryMap.get(r.rowIndex)!
      return {
        consultation_id: consultationId,
        chemical_id:     r.chemicalId!,
        role:            entry.function      ?? null,
        quantity:        entry.concentration ?? null,
        unit:            entry.concentration !== null ? "%" : null,
        product_name:    entry.productName   ?? '',
        alt_cas:         entry.altCas        ?? null,
        notes:           null as null,
      }
    }),
    ...pubchemNewRows
      .filter((r) => persistedChemicalMap.has(r.rowIndex))
      .map((r) => {
        const entry = entryMap.get(r.rowIndex)!
        return {
          consultation_id: consultationId,
          chemical_id:     persistedChemicalMap.get(r.rowIndex)!,
          role:            entry.function      ?? null,
          quantity:        entry.concentration ?? null,
          unit:            entry.concentration !== null ? "%" : null,
          product_name:    entry.productName   ?? '',
          alt_cas:         entry.altCas        ?? null,
          notes:           null as null,
        }
      }),
  ]

  for (let i = 0; i < matchedInserts.length; i += CHUNK) {
    const { error } = await reg
      .from("consultation_chemicals")
      .upsert(matchedInserts.slice(i, i + CHUNK), { onConflict: "consultation_id,chemical_id,product_name" })
    if (error) errors.push(`Chemical upsert failed (batch ${i / CHUNK + 1}): ${error.message}`)
  }
  if (onProgress) await onProgress(3, 5)

  // Phase 4 — Insert truly unresolved rows (chemical_id = null so consultants can review).
  // Also includes any pubchemNewRows that failed to persist (DB error).
  const failedPubchemRows = pubchemNewRows.filter((r) => !persistedChemicalMap.has(r.rowIndex))
  const allUnresolved = [...trulyUnresolved, ...failedPubchemRows]
  if (allUnresolved.length > 0) {
    const unresolvedInserts = allUnresolved.map((r) => {
      const entry = entryMap.get(r.rowIndex)!
      return {
        consultation_id: consultationId,
        chemical_id:     null as null,
        role:            entry.function      ?? null,
        quantity:        entry.concentration ?? null,
        unit:            entry.concentration !== null ? "%" : null,
        product_name:    entry.productName   ?? null,
        alt_cas:         entry.casNumber     ?? entry.altCas ?? null,
        notes:           entry.inciName      ?? null,
      }
    })

    for (let i = 0; i < unresolvedInserts.length; i += CHUNK) {
      const { error } = await reg
        .from("consultation_chemicals")
        .insert(unresolvedInserts.slice(i, i + CHUNK))
      if (error) errors.push(`Unresolved insert failed (batch ${i / CHUNK + 1}): ${error.message}`)
    }
  }
  if (onProgress) await onProgress(4, 5)

  // Phase 5 — Create stub consultation_products rows (volumes tab fills in details later)
  const distinctProducts = [...new Set(
    selectedRows.filter((r) => r.productName).map((r) => r.productName!)
  )]
  if (distinctProducts.length > 0) {
    const { error } = await reg
      .from("consultation_products")
      .upsert(
        distinctProducts.map((name) => ({ consultation_id: consultationId, product_name: name })),
        { onConflict: "consultation_id,product_name", ignoreDuplicates: true }
      )
    if (error) errors.push(`Product stub creation failed: ${error.message}`)
  }
  if (onProgress) await onProgress(5, 5)

  return {
    added:      matchedRows.length + persistedChemicalMap.size,
    unresolved: allUnresolved.length,
    skipped:    0,
    errors,
  }
}
