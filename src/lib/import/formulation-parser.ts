import type { ParsedRow } from "./excel-parser"

export interface FormulationEntry {
  rowIndex: number
  inciName: string | null
  casNumber: string | null
  altCas: string | null
  concentration: number | null
  function: string | null
  productName: string | null
}

const COLUMN_PATTERNS: Record<keyof Omit<FormulationEntry, "rowIndex">, RegExp[]> = {
  inciName:      [/^inci\s*name$/i, /^inci$/i, /^chemical\s*name$/i, /^ingredient\s*name$/i, /^name$/i],
  casNumber:     [/^cas\s*(number|no\.?|#)?$/i],
  altCas:        [/^alt\.?\s*cas(\s*(number|no\.?|#))?$/i, /^alternative\s*cas(\s*(number|no\.?|#))?$/i],
  concentration: [
    /^conc\.?\s*%?$/i,
    /^concentration\s*%?$/i,
    /^%$/i,
    /^conc(?:entration)?\s*\(%\)$/i,
    /^wt\.?\s*%$/i,
    /^weight\s*%$/i,
    /^%\s*(?:w\/w|v\/v|w\/v)?$/i,
    /^amount\s*%?$/i,
    /^level\s*%?$/i,
    /^percentage$/i,
  ],
  function:      [/^function$/i, /^role$/i, /^use$/i, /^purpose$/i],
  productName:   [/^product\s*name$/i, /^product$/i, /^formulation$/i],
}

function detectColumn(headers: string[], patterns: RegExp[]): string | null {
  for (const h of headers) {
    if (patterns.some((p) => p.test(h.trim()))) return h
  }
  return null
}

function parseConcentration(raw: string | number | null): number | null {
  if (raw === null || raw === undefined || raw === "") return null
  if (typeof raw === "number") return isNaN(raw) ? null : raw
  // strip trailing % sign before parsing
  const cleaned = String(raw).replace(/%\s*$/, "").trim()
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : n
}

function normaliseString(raw: string | number | null): string | null {
  if (raw === null || raw === undefined) return null
  const s = String(raw).trim()
  return s === "" ? null : s
}

export function parseFormulationRows(headers: string[], rows: ParsedRow[]): FormulationEntry[] {
  const colMap = {
    inciName:      detectColumn(headers, COLUMN_PATTERNS.inciName),
    casNumber:     detectColumn(headers, COLUMN_PATTERNS.casNumber),
    altCas:        detectColumn(headers, COLUMN_PATTERNS.altCas),
    concentration: detectColumn(headers, COLUMN_PATTERNS.concentration),
    function:      detectColumn(headers, COLUMN_PATTERNS.function),
    productName:   detectColumn(headers, COLUMN_PATTERNS.productName),
  }

  const hasAnyKnownColumn = Object.values(colMap).some(Boolean)
  if (!hasAnyKnownColumn) {
    throw new Error(
      "No recognised columns found. Expected headers include: " +
      '"INCI Name", "CAS Number", "Alt CAS", "Concentration %", "Function", "Product Name". ' +
      `Found: ${headers.join(", ")}`
    )
  }

  return rows
    .map((row, i): FormulationEntry => ({
      rowIndex:      i,
      inciName:      normaliseString(colMap.inciName      ? row[colMap.inciName]      : null),
      casNumber:     normaliseString(colMap.casNumber     ? row[colMap.casNumber]     : null),
      altCas:        normaliseString(colMap.altCas        ? row[colMap.altCas]        : null),
      concentration: parseConcentration(colMap.concentration ? row[colMap.concentration] : null),
      function:      normaliseString(colMap.function      ? row[colMap.function]      : null),
      productName:   normaliseString(colMap.productName   ? row[colMap.productName]   : null),
    }))
    .filter((e) => e.inciName || e.casNumber)
}
