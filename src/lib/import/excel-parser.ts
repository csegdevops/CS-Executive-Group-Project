import * as XLSX from "xlsx"

export interface ParsedRow {
  [columnHeader: string]: string | number | null
}

export interface ParseResult {
  headers: string[]
  rows: ParsedRow[]
}

export function parseExcelBuffer(buffer: Buffer, headerRowIndex = 0): ParseResult {
  const workbook = XLSX.read(buffer, { type: "buffer" })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]

  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
  }) as (string | number | null)[][]

  if (raw.length <= headerRowIndex) return { headers: [], rows: [] }

  const headers = (raw[headerRowIndex] ?? []).map((h) => String(h ?? "").trim())
  const rows: ParsedRow[] = raw.slice(headerRowIndex + 1).map((row) => {
    const obj: ParsedRow = {}
    headers.forEach((h, i) => {
      obj[h] = row[i] ?? null
    })
    return obj
  })

  return { headers, rows: rows.filter((r) => Object.values(r).some((v) => v !== null)) }
}

// A cell that may carry an embedded hyperlink URL alongside its display value.
export interface CellWithUrl {
  value: string
  url: string | null
}

export interface RichParsedRow {
  [columnHeader: string]: CellWithUrl
}

export interface RichParseResult {
  headers: string[]
  rows: RichParsedRow[]
}

// Extracts the URL from a HYPERLINK worksheet formula: =HYPERLINK("url","text")
// ECHA SVHC files use these formula-based hyperlinks rather than embedded hyperlinks,
// so cell.l?.Target is always null — the URL lives in cell.f instead.
function extractFormulaUrl(formula: string | undefined): string | null {
  if (!formula) return null
  const match = formula.match(/HYPERLINK\s*\(\s*"([^"]+)"/i)
  return match ? match[1] : null
}

// Like parseExcelBufferAutoDetect but preserves hyperlink URLs on each cell.
// Captures both embedded hyperlinks (cell.l.Target) and HYPERLINK() formula URLs (cell.f).
export function parseExcelBufferRich(
  buffer: Buffer,
  keywords: string[],
  maxScan = 10
): RichParseResult {
  // cellFormula: true ensures cell.f is populated for formula-based hyperlinks
  const workbook  = XLSX.read(buffer, { type: "buffer", cellFormula: true })
  const sheetName = workbook.SheetNames[0]
  const sheet     = workbook.Sheets[sheetName]

  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
  }) as (string | number | null)[][]

  let headerRowIdx = -1
  for (let i = 0; i < Math.min(maxScan, raw.length); i++) {
    const rowNorm  = (raw[i] ?? []).map((h) => String(h ?? "").toLowerCase())
    const nonEmpty = rowNorm.filter((h) => h.trim().length > 0)
    if (nonEmpty.length < 2) continue
    if (keywords.some((kw) => rowNorm.some((h) => h.includes(kw)))) {
      headerRowIdx = i
      break
    }
  }

  if (headerRowIdx === -1) return { headers: [], rows: [] }

  const headers = (raw[headerRowIdx] ?? []).map((h) => String(h ?? "").trim())

  const rows: RichParsedRow[] = raw.slice(headerRowIdx + 1).map((_, relIdx) => {
    const absoluteRowIdx = headerRowIdx + 1 + relIdx
    const obj: RichParsedRow = {}
    headers.forEach((header, colIdx) => {
      const cellRef = XLSX.utils.encode_cell({ r: absoluteRowIdx, c: colIdx })
      const cell = sheet[cellRef] as { v?: unknown; l?: { Target?: string }; f?: string } | undefined
      obj[header] = {
        value: String(cell?.v ?? "").trim(),
        url:   cell?.l?.Target ?? extractFormulaUrl(cell?.f) ?? null,
      }
    })
    return obj
  }).filter((row) => Object.values(row).some((c) => c.value !== ""))

  return { headers, rows }
}

// Scans the first `maxScan` rows to find the header row by matching any of the given keywords.
// Used for files like ECHA SVHC that have metadata rows before the actual column headers.
export function parseExcelBufferAutoDetect(
  buffer: Buffer,
  keywords: string[],
  maxScan = 10
): ParseResult {
  const workbook = XLSX.read(buffer, { type: "buffer" })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]

  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
  }) as (string | number | null)[][]

  for (let i = 0; i < Math.min(maxScan, raw.length); i++) {
    const rowNorm = (raw[i] ?? []).map((h) => String(h ?? "").toLowerCase())
    // Skip title/metadata rows — they typically have only one populated cell
    const nonEmptyCells = rowNorm.filter((h) => h.trim().length > 0)
    if (nonEmptyCells.length < 2) continue
    if (keywords.some((kw) => rowNorm.some((h) => h.includes(kw)))) {
      const headers = (raw[i] ?? []).map((h) => String(h ?? "").trim())
      const rows: ParsedRow[] = raw.slice(i + 1).map((row) => {
        const obj: ParsedRow = {}
        headers.forEach((h, j) => { obj[h] = (row as (string | number | null)[])[j] ?? null })
        return obj
      })
      return { headers, rows: rows.filter((r) => Object.values(r).some((v) => v !== null)) }
    }
  }

  return { headers: [], rows: [] }
}
