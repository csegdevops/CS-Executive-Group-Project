import { parseExcelBuffer } from "./excel-parser"
import { parseFormulationRows, type FormulationEntry } from "./formulation-parser"
import { prepareFormulationInput, aiFormulationParser } from "@/lib/formulation-parsing"
import { isAiPaused, AI_PAUSED_MESSAGE } from "@/lib/ai/pause"

const SPREADSHEET_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.ms-excel", // .xls
])

const EXT_MIME_MAP: Record<string, string> = {
  pdf:  "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  png:  "image/png",
  jpg:  "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif:  "image/gif",
}

export interface ParsedFormulationFile {
  entries: FormulationEntry[]
  source: "deterministic" | "ai"
}

function isSpreadsheet(name: string, mimeType: string): boolean {
  if (SPREADSHEET_MIME_TYPES.has(mimeType)) return true
  return /\.(xlsx|xls)$/i.test(name)
}

function guessMimeFromName(name: string): string {
  const ext = name.toLowerCase().split(".").pop() ?? ""
  return EXT_MIME_MAP[ext] ?? "application/octet-stream"
}

// Parses an uploaded formulation file into entries, preferring the fast/free
// deterministic Excel column-matcher for spreadsheets and falling back to AI
// extraction (src/lib/formulation-parsing) only when that parser can't
// recognise the columns, or when the file isn't a spreadsheet at all
// (PDF/.docx/image). Shared by /api/formulation and
// /api/consultations/[id]/upload so both upload surfaces behave the same.
//
// canUseAi is resolved by the caller from the requesting user's permissions
// (ai.formulation.use) — checked here, not upfront in the route, because
// whether AI is even needed depends on the file (spreadsheets with
// recognised columns never touch it).
export async function parseFormulationFile(file: File, canUseAi: boolean): Promise<ParsedFormulationFile> {
  const buffer = Buffer.from(await file.arrayBuffer())

  if (isSpreadsheet(file.name, file.type)) {
    try {
      const { headers, rows } = parseExcelBuffer(buffer)
      const entries = parseFormulationRows(headers, rows)
      return { entries, source: "deterministic" }
    } catch (err) {
      // Only fall through to AI for "columns not recognised" — a genuinely
      // corrupt/unreadable spreadsheet should still surface as an error.
      if (!(err instanceof Error) || !err.message.startsWith("No recognised columns")) throw err
    }
  }

  if (!canUseAi) throw new Error("Forbidden — AI formulation permission required")
  if (await isAiPaused()) throw new Error(AI_PAUSED_MESSAGE)

  const mimeType = file.type || guessMimeFromName(file.name)
  const input = await prepareFormulationInput(buffer, mimeType)
  const raw = await aiFormulationParser.extractEntries(input)
  const entries: FormulationEntry[] = raw.map((e, i) => ({ rowIndex: i, ...e }))
  return { entries, source: "ai" }
}
