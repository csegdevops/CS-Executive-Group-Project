import { createAdminClient } from "@/lib/supabase/admin"
import type { AicisEntry } from "./aicis-parser"
import type { RegulatoryStatus } from "@/types/database"

export interface RegulatoryListPreviewRow {
  rowIndex: number
  crNumber: string | null
  inputCas: string | null
  inputName: string | null
  chemicalId: string | null
  resolvedName: string | null
  resolvedCas: string | null
  status: RegulatoryStatus
  isNew: boolean
  error: string | null
}

export interface RegulatoryListPreview {
  rows: RegulatoryListPreviewRow[]
  existingCount: number
  newCount: number
  errorCount: number
}

function deriveStatus(conditions: string | null): RegulatoryStatus {
  return conditions ? "restricted" : "listed"
}

type ChemicalRecord = { id: string; common_name: string; cas_number: string | null }

const CHUNK = 500

export async function generateAicisPreview(
  entries: AicisEntry[],
  onProgress?: (done: number, total: number) => Promise<void>
): Promise<RegulatoryListPreview> {
  const admin = createAdminClient()
  const reg = admin.schema("regulatory")

  // Phase 1 — Batch CAS lookup: one query instead of one per entry
  const uniqueCas = [
    ...new Set(entries.map((e) => e.casNumber).filter((c): c is string => Boolean(c))),
  ]

  const casMap = new Map<string, ChemicalRecord>()

  if (uniqueCas.length > 0) {
    const { data } = await reg
      .from("chemicals")
      .select("id, common_name, cas_number")
      .in("cas_number", uniqueCas)
    for (const c of data ?? []) casMap.set(c.cas_number!, c)
  }

  if (onProgress) await onProgress(1, 3)

  // Phase 2 — Batch alias lookup for entries not resolved by CAS
  // Uses RPC to avoid URL-encoding issues with long IUPAC names containing commas.
  const aliasMap = new Map<string, ChemicalRecord>()
  const unresolvedNames = [
    ...new Set(
      entries
        .filter((e) => !casMap.has(e.casNumber ?? "") && e.chemicalName)
        .map((e) => e.chemicalName!)
    ),
  ]

  for (let i = 0; i < unresolvedNames.length; i += CHUNK) {
    const chunk = unresolvedNames.slice(i, i + CHUNK)
    const { data } = await admin.rpc("match_chemicals_by_names", { names: chunk })
    for (const row of (data ?? []) as Array<{ input_name: string; chemical_id: string; common_name: string; cas_number: string | null }>) {
      aliasMap.set(row.input_name.toLowerCase(), {
        id: row.chemical_id,
        common_name: row.common_name,
        cas_number: row.cas_number,
      })
    }
  }

  if (onProgress) await onProgress(2, 3)

  // Phase 3 — Build all rows in memory: zero DB calls
  const rows: RegulatoryListPreviewRow[] = entries.map((entry) => {
    const chemical =
      (entry.casNumber ? casMap.get(entry.casNumber) : undefined) ??
      (entry.chemicalName ? aliasMap.get(entry.chemicalName.toLowerCase()) : undefined) ??
      null

    return {
      rowIndex:     entry.rowIndex,
      crNumber:     entry.crNumber,
      inputCas:     entry.casNumber,
      inputName:    entry.chemicalName,
      chemicalId:   chemical?.id ?? null,
      resolvedName: chemical?.common_name ?? entry.chemicalName,
      resolvedCas:  chemical?.cas_number ?? entry.casNumber,
      status:       deriveStatus(entry.conditions),
      isNew:        !chemical,
      error:        null,
    }
  })

  if (onProgress) await onProgress(3, 3)

  return {
    rows,
    existingCount: rows.filter((r) => !r.isNew).length,
    newCount:      rows.filter((r) => r.isNew).length,
    errorCount:    0,
  }
}

export async function commitAicisImport(
  preview: RegulatoryListPreview,
  entries: AicisEntry[],
  selectedRowIndexes: number[],
  onProgress?: (done: number, total: number) => Promise<void>
): Promise<{ upserted: number; skipped: number; errors: string[] }> {
  const reg = createAdminClient().schema("regulatory")
  const selectedSet = new Set(selectedRowIndexes)
  const entryMap = new Map(entries.map((e) => [e.rowIndex, e]))
  const errors: string[] = []

  const selectedRows = preview.rows.filter((r) => selectedSet.has(r.rowIndex))

  // Track which rows have a resolved chemical ID (filled as each phase runs)
  const resolvedIds = new Map<number, string>()
  for (const r of selectedRows.filter((r) => r.chemicalId)) {
    resolvedIds.set(r.rowIndex, r.chemicalId!)
  }

  const newRows     = selectedRows.filter((r) => !r.chemicalId)
  const newWithCas  = newRows.filter((r) => Boolean(entryMap.get(r.rowIndex)?.casNumber))
  const newNoCas    = newRows.filter((r) => !entryMap.get(r.rowIndex)?.casNumber)

  // Phase 1 — Batch upsert chemicals that have a CAS number
  for (let i = 0; i < newWithCas.length; i += CHUNK) {
    const chunk = newWithCas.slice(i, i + CHUNK)

    // Deduplicate CAS numbers within the chunk (two entries can share a CAS)
    const casToFirstRow = new Map<string, typeof chunk[number]>()
    for (const r of chunk) {
      const cas = entryMap.get(r.rowIndex)!.casNumber!
      if (!casToFirstRow.has(cas)) casToFirstRow.set(cas, r)
    }

    const toUpsert = [...casToFirstRow.entries()].map(([cas, r]) => {
      const entry = entryMap.get(r.rowIndex)!
      return {
        cas_number:        cas,
        common_name:       entry.chemicalName ?? entry.approvedNames[0] ?? "Unknown",
        molecular_formula: entry.molecularFormula,
        needs_review:      false,
        resolved_at:       new Date().toISOString(),
      }
    })

    const { data, error } = await reg
      .from("chemicals")
      .upsert(toUpsert, { onConflict: "cas_number" })
      .select("id, cas_number")

    if (error) {
      errors.push(`Chemical upsert failed (batch ${i / CHUNK + 1}): ${error.message}`)
      continue
    }

    const casToId = new Map((data ?? []).map((c) => [c.cas_number, c.id]))
    for (const r of chunk) {
      const cas = entryMap.get(r.rowIndex)!.casNumber!
      const id  = casToId.get(cas)
      if (id) resolvedIds.set(r.rowIndex, id)
      else errors.push(`Row ${r.rowIndex}: chemical ID missing after upsert`)
    }
  }

  if (onProgress) await onProgress(1, 4)

  // Phase 2 — Individual inserts for chemicals without CAS (rare in AICIS imports)
  for (const r of newNoCas) {
    const entry = entryMap.get(r.rowIndex)!
    const name  = entry.chemicalName ?? entry.approvedNames[0] ?? "Unknown"
    const { data, error } = await reg
      .from("chemicals")
      .insert({ common_name: name, molecular_formula: entry.molecularFormula, needs_review: true })
      .select("id")
      .single()
    if (error || !data) {
      errors.push(`Row ${r.rowIndex} (${name}): insert failed — ${error?.message}`)
    } else {
      resolvedIds.set(r.rowIndex, data.id)
    }
  }

  if (onProgress) await onProgress(2, 4)

  // Phase 3 — Batch upsert all aliases
  const allAliases = selectedRows.flatMap((r) => {
    const chemicalId = resolvedIds.get(r.rowIndex)
    if (!chemicalId) return []
    const entry = entryMap.get(r.rowIndex)!
    return [
      ...entry.approvedNames.map((alias) => ({
        chemical_id: chemicalId,
        alias,
        alias_type: "synonym" as const,
        source:     "manual"  as const,
      })),
      ...(entry.crNumber
        ? [{ chemical_id: chemicalId, alias: entry.crNumber, alias_type: "synonym" as const, source: "manual" as const }]
        : []),
    ]
  })

  for (let i = 0; i < allAliases.length; i += CHUNK) {
    const { error } = await reg
      .from("chemical_aliases")
      .upsert(allAliases.slice(i, i + CHUNK), { onConflict: "chemical_id,alias", ignoreDuplicates: true })
    if (error) errors.push(`Alias upsert failed (batch ${i / CHUNK + 1}): ${error.message}`)
  }

  if (onProgress) await onProgress(3, 4)

  // Phase 4 — Batch upsert all regulatory_listings
  const now = new Date().toISOString()
  const allListings = selectedRows.flatMap((r) => {
    const chemicalId = resolvedIds.get(r.rowIndex)
    if (!chemicalId) return []
    const entry = entryMap.get(r.rowIndex)!
    return [{
      chemical_id:  chemicalId,
      framework:    "aicis" as const,
      status:       r.status,
      list_name:    "AICIS Inventory",
      notes:        entry.notes ?? entry.conditions,
      last_checked: now,
      source:       "manual",
    }]
  })

  for (let i = 0; i < allListings.length; i += CHUNK) {
    const { error } = await reg
      .from("regulatory_listings")
      .upsert(allListings.slice(i, i + CHUNK), { onConflict: "chemical_id,framework" })
    if (error) errors.push(`Listings upsert failed (batch ${i / CHUNK + 1}): ${error.message}`)
  }

  if (onProgress) await onProgress(4, 4)

  const upserted = resolvedIds.size
  const skipped  = selectedRows.length - upserted

  return { upserted, skipped, errors }
}
