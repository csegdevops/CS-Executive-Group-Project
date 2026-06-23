import type { ParsedRow } from "./excel-parser"

export interface AicisEntry {
  rowIndex: number
  crNumber: string | null
  casNumber: string | null
  chemicalName: string | null
  approvedNames: string[]
  molecularFormula: string | null
  conditions: string | null
  notes: string | null
}

function findCol(headers: string[], pattern: RegExp): string | null {
  return (
    headers.find((h) => pattern.test(h.replace(/\s+/g, " ").trim())) ?? null
  )
}

function cell(row: ParsedRow, col: string | null): string {
  if (!col) return ""
  return String(row[col] ?? "").trim()
}

export function parseAicisRows(headers: string[], rows: ParsedRow[]): AicisEntry[] {
  const crCol       = findCol(headers, /^cr\s*no\.?$/i)
  const casCol      = findCol(headers, /^cas\s*no\.?$/i)
  const nameCol     = findCol(headers, /^chemical\s*name$/i)
  const approvedCol = findCol(headers, /^aicis\s+approved\s+chemical\s+name$/i)
  const formulaCol  = findCol(headers, /^molecular\s+formula$/i)
  const specificCol = findCol(headers, /^specific\s+information/i)
  const scopeCol    = findCol(headers, /^defined\s+scope/i)
  const condCol     = findCol(headers, /^condition\s+of\s+introduction/i)
  const prescCol    = findCol(headers, /^prescribed\s+information$/i)

  return rows
    .map((row, i) => {
      const approvedRaw = cell(row, approvedCol)
      // Cells with multiple approved names use newlines (alt+enter in Excel)
      const approvedNames = approvedRaw
        ? approvedRaw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
        : []

      const noteParts = [
        cell(row, specificCol) ? `Info requirements: ${cell(row, specificCol)}` : null,
        cell(row, scopeCol)    ? `Scope: ${cell(row, scopeCol)}`                : null,
        cell(row, prescCol)    ? `Prescribed: ${cell(row, prescCol)}`           : null,
      ].filter(Boolean)

      const rawCas = cell(row, casCol)
      return {
        rowIndex:       i,
        crNumber:       cell(row, crCol)      || null,
        // Filter out placeholder text like "None", "N/A", "Not assigned", "-"
        casNumber:      /^\d{2,7}-\d{2}-\d$/.test(rawCas) ? rawCas : null,
        chemicalName:   cell(row, nameCol)    || approvedNames[0] || null,
        approvedNames,
        molecularFormula: cell(row, formulaCol) || null,
        conditions:     cell(row, condCol)    || null,
        notes:          noteParts.length ? noteParts.join(" | ") : null,
      }
    })
    .filter((e) => e.casNumber || e.chemicalName)
}
