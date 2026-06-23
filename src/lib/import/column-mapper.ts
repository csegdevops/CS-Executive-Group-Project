import type { ParsedRow } from "./excel-parser"

export interface ColumnMapping {
  casColumn: string | null
  nameColumn: string | null
  quantityColumn: string | null
  unitColumn: string | null
  notesColumn: string | null
  roleColumn: string | null
}

export interface ChemicalImportEntry {
  cas: string | null
  name: string | null
  quantity: number | null
  unit: string | null
  notes: string | null
  role: string | null
  rowIndex: number
}

const CAS_HEADERS = /^(cas|cas[\s._-]?no|cas[\s._-]?number|cas[\s._-]?rn)$/i
const NAME_HEADERS = /^(name|chemical|chemical[\s._-]?name|substance|substance[\s._-]?name|compound)$/i
const QTY_HEADERS = /^(qty|quantity|amount|concentration|conc)$/i
const UNIT_HEADERS = /^(unit|units|uom|measure)$/i
const NOTES_HEADERS = /^(notes?|comments?|remarks?|description)$/i
const ROLE_HEADERS = /^(role|type|function|category|use)$/i

export function autoDetectMapping(headers: string[]): ColumnMapping {
  return {
    casColumn: headers.find((h) => CAS_HEADERS.test(h.trim())) ?? null,
    nameColumn: headers.find((h) => NAME_HEADERS.test(h.trim())) ?? null,
    quantityColumn: headers.find((h) => QTY_HEADERS.test(h.trim())) ?? null,
    unitColumn: headers.find((h) => UNIT_HEADERS.test(h.trim())) ?? null,
    notesColumn: headers.find((h) => NOTES_HEADERS.test(h.trim())) ?? null,
    roleColumn: headers.find((h) => ROLE_HEADERS.test(h.trim())) ?? null,
  }
}

export function applyMapping(rows: ParsedRow[], mapping: ColumnMapping): ChemicalImportEntry[] {
  return rows.map((row, i) => {
    const cas = mapping.casColumn ? String(row[mapping.casColumn] ?? "").trim() || null : null
    const name = mapping.nameColumn ? String(row[mapping.nameColumn] ?? "").trim() || null : null
    const qtyRaw = mapping.quantityColumn ? row[mapping.quantityColumn] : null
    const quantity = qtyRaw !== null && qtyRaw !== "" ? Number(qtyRaw) : null

    return {
      cas,
      name,
      quantity: isNaN(quantity as number) ? null : quantity,
      unit: mapping.unitColumn ? String(row[mapping.unitColumn] ?? "").trim() || null : null,
      notes: mapping.notesColumn ? String(row[mapping.notesColumn] ?? "").trim() || null : null,
      role: mapping.roleColumn ? String(row[mapping.roleColumn] ?? "").trim() || null : null,
      rowIndex: i,
    }
  }).filter((e) => e.cas || e.name)
}
