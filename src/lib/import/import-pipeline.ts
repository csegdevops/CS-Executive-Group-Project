import { resolveAndPersistChemical } from "@/lib/chemicals/resolver"
import type { ChemicalImportEntry } from "./column-mapper"
import type { RegulatoryFramework } from "@/types/database"
import { createAdminClient } from "@/lib/supabase/admin"

export interface ImportPreviewRow {
  rowIndex: number
  cas: string | null
  name: string | null
  role: string | null
  quantity: number | null
  unit: string | null
  notes: string | null
  resolved: boolean
  chemicalId: string | null
  chemicalName: string | null
  resolvedCas: string | null
  needsReview: boolean
  error: string | null
}

export interface ImportPreview {
  rows: ImportPreviewRow[]
  resolvedCount: number
  unresolvedCount: number
  needsReviewCount: number
}

export async function generateImportPreview(
  entries: ChemicalImportEntry[],
  frameworks: RegulatoryFramework[]
): Promise<ImportPreview> {
  const rows: ImportPreviewRow[] = []

  for (const entry of entries) {
    if (!entry.cas && !entry.name) {
      rows.push({
        rowIndex: entry.rowIndex, cas: null, name: null,
        role: entry.role, quantity: entry.quantity, unit: entry.unit, notes: entry.notes,
        resolved: false, chemicalId: null, chemicalName: null, resolvedCas: null,
        needsReview: false, error: "No CAS or name provided",
      })
      continue
    }

    try {
      const chemical = await resolveAndPersistChemical(
        { cas: entry.cas ?? undefined, name: entry.name ?? undefined },
        frameworks
      )
      rows.push({
        rowIndex: entry.rowIndex,
        cas: entry.cas, name: entry.name,
        role: entry.role, quantity: entry.quantity, unit: entry.unit, notes: entry.notes,
        resolved: true,
        chemicalId: chemical.id,
        chemicalName: chemical.common_name,
        resolvedCas: chemical.cas_number,
        needsReview: chemical.needs_review,
        error: null,
      })
    } catch (err) {
      rows.push({
        rowIndex: entry.rowIndex, cas: entry.cas, name: entry.name,
        role: entry.role, quantity: entry.quantity, unit: entry.unit, notes: entry.notes,
        resolved: false, chemicalId: null, chemicalName: null, resolvedCas: null,
        needsReview: false,
        error: err instanceof Error ? err.message : "Unknown error",
      })
    }
  }

  return {
    rows,
    resolvedCount: rows.filter((r) => r.resolved && !r.needsReview).length,
    unresolvedCount: rows.filter((r) => !r.resolved).length,
    needsReviewCount: rows.filter((r) => r.resolved && r.needsReview).length,
  }
}

export async function commitImport(
  preview: ImportPreview,
  consultationId: string,
  selectedRowIndexes: number[]
): Promise<{ added: number; skipped: number }> {
  const admin = createAdminClient()
  const selectedSet = new Set(selectedRowIndexes)
  const toCommit = preview.rows.filter(
    (r) => selectedSet.has(r.rowIndex) && r.resolved && r.chemicalId
  )

  let added = 0
  let skipped = 0

  for (const row of toCommit) {
    const { error } = await admin
      .schema("regulatory")
      .from("consultation_chemicals")
      .upsert({
        consultation_id: consultationId,
        chemical_id: row.chemicalId!,
        role: row.role,
        quantity: row.quantity,
        unit: row.unit,
        notes: row.notes,
      }, { onConflict: "consultation_id,chemical_id", ignoreDuplicates: true })

    if (error) {
      skipped++
    } else {
      added++
    }
  }

  return { added, skipped }
}
