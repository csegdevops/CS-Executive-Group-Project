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

export async function generateAicisPreview(
  entries: AicisEntry[],
  onProgress?: (done: number, total: number) => Promise<void>
): Promise<RegulatoryListPreview> {
  const reg = createAdminClient().schema("regulatory")
  const rows: RegulatoryListPreviewRow[] = []

  for (const entry of entries) {
    let chemicalId: string | null = null
    let resolvedName: string | null = null
    let resolvedCas: string | null = null

    if (entry.casNumber) {
      const { data } = await reg
        .from("chemicals")
        .select("id, common_name, cas_number")
        .eq("cas_number", entry.casNumber)
        .maybeSingle()
      if (data) {
        chemicalId = data.id
        resolvedName = data.common_name
        resolvedCas = data.cas_number
      }
    }

    if (!chemicalId && entry.chemicalName) {
      const { data } = await reg
        .from("chemical_aliases")
        .select("chemical_id, chemicals(id, common_name, cas_number)")
        .ilike("alias", entry.chemicalName)
        .limit(1)
        .maybeSingle()
      if (data?.chemicals) {
        const c = data.chemicals as { id: string; common_name: string; cas_number: string | null }
        chemicalId = c.id
        resolvedName = c.common_name
        resolvedCas = c.cas_number
      }
    }

    rows.push({
      rowIndex:     entry.rowIndex,
      crNumber:     entry.crNumber,
      inputCas:     entry.casNumber,
      inputName:    entry.chemicalName,
      chemicalId,
      resolvedName: chemicalId ? resolvedName : entry.chemicalName,
      resolvedCas:  chemicalId ? resolvedCas  : entry.casNumber,
      status:       deriveStatus(entry.conditions),
      isNew:        !chemicalId,
      error:        null,
    })

    if (onProgress) await onProgress(rows.length, entries.length)
  }

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
  const total = selectedRowIndexes.length

  let upserted = 0
  let skipped = 0
  let processed = 0
  const errors: string[] = []

  for (const row of preview.rows) {
    if (!selectedSet.has(row.rowIndex)) { continue }

    try {
      const entry = entryMap.get(row.rowIndex)
      if (!entry) {
        errors.push(`Row ${row.rowIndex}: could not match entry — rowIndex mismatch`)
        skipped++
        continue
      }

      let chemicalId = row.chemicalId

      if (!chemicalId) {
        const name = entry.chemicalName ?? entry.approvedNames[0] ?? "Unknown"

        if (entry.casNumber) {
          // Upsert by CAS — safe for re-imports and avoids duplicate-key failures
          const { data, error } = await reg
            .from("chemicals")
            .upsert(
              {
                cas_number:        entry.casNumber,
                common_name:       name,
                molecular_formula: entry.molecularFormula,
                needs_review:      false,
                resolved_at:       new Date().toISOString(),
              },
              { onConflict: "cas_number" }
            )
            .select("id")
            .single()

          if (error || !data) {
            errors.push(`Row ${row.rowIndex} (${entry.casNumber}): chemical upsert failed — ${error?.message}`)
            skipped++
            continue
          }
          chemicalId = data.id
        } else {
          // No valid CAS — plain insert; will always create a new record
          const { data, error } = await reg
            .from("chemicals")
            .insert({
              common_name:       name,
              molecular_formula: entry.molecularFormula,
              needs_review:      true,
            })
            .select("id")
            .single()

          if (error || !data) {
            errors.push(`Row ${row.rowIndex} (${name}): chemical insert failed — ${error?.message}`)
            skipped++
            continue
          }
          chemicalId = data.id
        }
      }

      const aliases = [
        ...entry.approvedNames.map((alias) => ({
          chemical_id: chemicalId!,
          alias,
          alias_type: "synonym" as const,
          source:     "manual" as const,
        })),
        ...(entry.crNumber
          ? [{ chemical_id: chemicalId!, alias: entry.crNumber, alias_type: "synonym" as const, source: "manual" as const }]
          : []),
      ]

      if (aliases.length) {
        await reg
          .from("chemical_aliases")
          .upsert(aliases, { onConflict: "chemical_id,alias", ignoreDuplicates: true })
      }

      const { error: listingError } = await reg
        .from("regulatory_listings")
        .upsert(
          {
            chemical_id:  chemicalId,
            framework:    "aicis",
            status:       row.status,
            list_name:    "AICIS Inventory",
            notes:        entry.notes ?? entry.conditions,
            last_checked: new Date().toISOString(),
            source:       "manual",
          },
          { onConflict: "chemical_id,framework" }
        )

      if (listingError) {
        errors.push(`Row ${row.rowIndex}: regulatory_listings upsert failed — ${listingError.message}`)
        skipped++
        continue
      }
      upserted++
    } finally {
      // Runs on every path (success, skip, error) for selected rows
      if (onProgress) await onProgress(++processed, total)
    }
  }

  return { upserted, skipped, errors }
}
