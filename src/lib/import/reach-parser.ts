import type { RichParsedRow } from "./excel-parser"

export interface ReachEntry {
  rowIndex: number
  ecNumber: string | null
  casNumber: string | null
  substanceName: string | null
  reason: string | null         // Reason for inclusion
  dateInclusion: string | null  // Date of inclusion → regulatory_listings.effective_date
  decisionUrl: string | null    // Reason for decision link → regulatory_listings.list_url
  outcome: string | null        // Outcome (e.g. restriction decision result)
  outcomeDate: string | null    // Outcome date
}

function findCol(headers: string[], pattern: RegExp): string | null {
  return headers.find((h) => pattern.test(h.replace(/\s+/g, " ").trim())) ?? null
}

function richCell(row: RichParsedRow, col: string | null): { value: string; url: string | null } {
  if (!col) return { value: "", url: null }
  return row[col] ?? { value: "", url: null }
}

export function parseReachRows(headers: string[], rows: RichParsedRow[]): ReachEntry[] {
  const nameCol     = findCol(headers, /^substance\s*name$/i)
  const ecCol       = findCol(headers, /^ec\s*[/]?\s*(list|number)/i)
  const casCol      = findCol(headers, /^cas\s*(no\.?|number|rn)?$/i)
  const reasonCol   = findCol(headers, /^reason\s+for\s+inclusion/i)
  const dateCol     = findCol(headers, /^date\s+of\s+inclusion/i)
  // ECHA uses "Reason for decision" — try exact match first, then any column containing "decision"
  const decisionCol = findCol(headers, /reason\s+for\s+decision/i) ?? findCol(headers, /decision/i)
  const outcomeCol  = findCol(headers, /^outcome$/i)
  const outDateCol  = findCol(headers, /^outcome\s*date/i)

  return rows
    .map((row, i) => {
      const casCell      = richCell(row, casCol)
      const reasonCell   = richCell(row, reasonCol)
      const decisionCell = richCell(row, decisionCol)

      // Decision URL: prefer the hyperlink target; fall back to cell value if it looks like a URL
      const decisionUrl =
        decisionCell.url ??
        (decisionCell.value.startsWith("http") ? decisionCell.value : null) ??
        reasonCell.url ??   // "Reason for inclusion" is sometimes hyperlinked to the decision doc
        null

      return {
        rowIndex:      i,
        ecNumber:      richCell(row, ecCol).value   || null,
        casNumber:     /^\d{2,7}-\d{2}-\d$/.test(casCell.value) ? casCell.value : null,
        substanceName: richCell(row, nameCol).value || null,
        reason:        reasonCell.value             || null,
        dateInclusion: richCell(row, dateCol).value || null,
        decisionUrl,
        outcome:       richCell(row, outcomeCol).value  || null,
        outcomeDate:   richCell(row, outDateCol).value  || null,
      }
    })
    .filter((e) => e.casNumber || e.substanceName)
}
