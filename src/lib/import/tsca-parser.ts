import type { ParsedRow } from "./excel-parser"

export interface TscaEntry {
  rowIndex: number
  casNumber: string | null
  substanceName: string | null
  isActive: boolean  // false = not_listed; PMNACC_ entries default to true
}

function findCol(headers: string[], pattern: RegExp): string | null {
  return headers.find((h) => pattern.test(h.replace(/\s+/g, " ").trim())) ?? null
}

function cell(row: ParsedRow, col: string | null): string {
  if (!col) return ""
  return String(row[col] ?? "").trim()
}

export function parseTscaRows(headers: string[], rows: ParsedRow[]): TscaEntry[] {
  // TSCAINV_: CASRN, ChemNam, ACTIVITY  (values: ACTIVE / INACTIVE)
  // PMNACC_:  PMNNO, GenericName, ACTIVITY  (no CAS column)
  const casCol    = findCol(headers, /^cas\s*rn?$/i)   // CASRN, CAS RN, CAS
  const nameCol   = findCol(headers, /^(chemnam(e)?|generic\s*name|chemical\s*(substance\s*)?name)$/i)
  const activeCol = findCol(headers, /^activ/i)         // ACTIVITY or ACTIVE (Y/N)

  return rows
    .map((row, i) => {
      const rawCas    = cell(row, casCol)
      const activeVal = activeCol ? cell(row, activeCol).toUpperCase() : "ACTIVE"
      return {
        rowIndex:      i,
        casNumber:     /^\d{2,7}-\d{2}-\d$/.test(rawCas) ? rawCas : null,
        substanceName: cell(row, nameCol) || null,
        // INACTIVE = not listed; treat ACTIVE (or blank/unknown) as listed
        isActive:      !["N", "NO", "FALSE", "0", "INACTIVE"].includes(activeVal),
      }
    })
    .filter((e) => e.casNumber || e.substanceName)
}
