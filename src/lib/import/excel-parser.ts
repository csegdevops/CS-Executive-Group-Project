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
