import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { parseExcelBuffer, parseExcelBufferAutoDetect, parseExcelBufferRich } from "@/lib/import/excel-parser"
import { parseAicisRows } from "@/lib/import/aicis-parser"
import { parseReachRows } from "@/lib/import/reach-parser"
import { parseTscaRows } from "@/lib/import/tsca-parser"
import {
  generateAicisPreview,
  commitAicisImport,
  generateReachPreview,
  commitReachImport,
  generateTscaPreview,
  commitTscaImport,
} from "@/lib/import/regulatory-list-pipeline"
import type { RegulatoryListPreview } from "@/lib/import/regulatory-list-pipeline"
import type { AicisEntry } from "@/lib/import/aicis-parser"
import type { ReachEntry } from "@/lib/import/reach-parser"
import type { TscaEntry } from "@/lib/import/tsca-parser"

async function requireUploadAccess(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role === "super_admin") return user
  const { data: access } = await supabase
    .from("user_module_access")
    .select("access_level")
    .eq("user_id", user.id)
    .eq("module", "regulatory")
    .maybeSingle()
  if (access?.access_level !== "admin") return null
  return user
}

const enc = new TextEncoder()
const ndjson = (obj: object) => enc.encode(JSON.stringify(obj) + "\n")

type AnyEntry = AicisEntry | ReachEntry | TscaEntry

function streamPreview(source: string, entries: AnyEntry[]) {
  return new ReadableStream({
    async start(controller) {
      try {
        let preview: RegulatoryListPreview
        if (source === "reach") {
          preview = await generateReachPreview(entries as ReachEntry[], async (done, total) => {
            controller.enqueue(ndjson({ type: "progress", done, total }))
          })
        } else if (source === "tsca") {
          preview = await generateTscaPreview(entries as TscaEntry[], async (done, total) => {
            controller.enqueue(ndjson({ type: "progress", done, total }))
          })
        } else {
          preview = await generateAicisPreview(entries as AicisEntry[], async (done, total) => {
            controller.enqueue(ndjson({ type: "progress", done, total }))
          })
        }
        controller.enqueue(ndjson({ type: "result", entries, preview }))
      } catch (err) {
        controller.enqueue(
          ndjson({ type: "error", message: err instanceof Error ? err.message : "Unknown error" })
        )
      } finally {
        controller.close()
      }
    },
  })
}

function streamCommit(
  source: string,
  preview: RegulatoryListPreview,
  entries: AnyEntry[],
  selectedRows: number[]
) {
  return new ReadableStream({
    async start(controller) {
      try {
        let result: { upserted: number; skipped: number; errors: string[] }
        if (source === "reach") {
          result = await commitReachImport(preview, entries as ReachEntry[], selectedRows, async (done, total) => {
            controller.enqueue(ndjson({ type: "progress", done, total }))
          })
        } else if (source === "tsca") {
          result = await commitTscaImport(preview, entries as TscaEntry[], selectedRows, async (done, total) => {
            controller.enqueue(ndjson({ type: "progress", done, total }))
          })
        } else {
          result = await commitAicisImport(preview, entries as AicisEntry[], selectedRows, async (done, total) => {
            controller.enqueue(ndjson({ type: "progress", done, total }))
          })
        }
        controller.enqueue(ndjson({ type: "result", ...result }))
      } catch (err) {
        controller.enqueue(
          ndjson({ type: "error", message: err instanceof Error ? err.message : "Unknown error" })
        )
      } finally {
        controller.close()
      }
    },
  })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const caller = await requireUploadAccess(supabase)
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const contentType = request.headers.get("content-type") ?? ""

  // ── JSON body → streaming preview (phase 2 of the two-phase upload) ─────────
  if (contentType.includes("application/json")) {
    const body = await request.json() as {
      action: string
      source: string
      entries?: AicisEntry[]
      preview?: RegulatoryListPreview
      selectedRows?: number[]
    }

    const streamHeaders = {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache, no-store",
      "X-Accel-Buffering": "no",
    }

    if (body.action === "preview") {
      if (!["aicis", "reach", "tsca"].includes(body.source)) {
        return NextResponse.json({ error: `Source "${body.source}" not supported` }, { status: 400 })
      }
      if (!Array.isArray(body.entries)) {
        return NextResponse.json({ error: "entries array required" }, { status: 400 })
      }
      return new Response(streamPreview(body.source, body.entries), { headers: streamHeaders })
    }

    if (body.action === "commit") {
      if (!body.preview || !Array.isArray(body.entries) || !Array.isArray(body.selectedRows)) {
        return NextResponse.json({ error: "preview, entries, and selectedRows required" }, { status: 400 })
      }
      return new Response(streamCommit(body.source, body.preview, body.entries, body.selectedRows), { headers: streamHeaders })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  }

  // ── FormData body → parse (phase 1) or commit ────────────────────────────────
  const formData = await request.formData()
  const action = formData.get("action") as string
  const source = formData.get("source") as string

  // action=parse: upload Excel file, return entries JSON (used for XHR upload progress)
  if (action === "parse") {
    const file = formData.get("file") as File | null
    if (!file) return NextResponse.json({ error: "file required" }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())

    let entries: AnyEntry[]
    if (source === "reach") {
      // ECHA SVHC files have metadata rows above the headers — use the rich parser so
      // hyperlinked cells (e.g. "Reason for decision") have their URLs captured.
      // Use column-header-specific phrases to skip the title row ("substances" ≠ "substance name").
      const { headers, rows: richRows } = parseExcelBufferRich(buffer, ["substance name", "ec / list", "reason for inclusion", "reason for decision", "cas number"])
      entries = parseReachRows(headers, richRows)
      // Validate: a REACH file must have a substance name or EC number column.
      // If neither found, the user likely uploaded the wrong file.
      const hasSubstanceCol = headers.some((h) => /substance/i.test(h))
      const hasEcCol        = headers.some((h) => /ec\s*[/\/]/i.test(h))
      if (!hasSubstanceCol && !hasEcCol) {
        return NextResponse.json({
          error: "This doesn't look like an ECHA SVHC file — expected columns 'Substance name' and 'EC / List number' were not found. Did you select the wrong source?",
        }, { status: 400 })
      }
    } else if (source === "tsca") {
      // Handles both TSCAINV_ (CASRN, ChemNam, ACTIVITY) and PMNACC_ (PMNNO, GenericName, ACTIVITY).
      const { headers, rows } = parseExcelBufferAutoDetect(buffer, ["casrn", "chemnam", "genericname", "pmnno", "activity"])
      entries = parseTscaRows(headers, rows)
      // Validate: must have a CAS column or a Chemical/Generic name column.
      // TSCAINV_: CASRN + ChemNam; PMNACC_: PMNNO + GenericName (no CAS).
      const hasCasCol    = headers.some((h) => /^cas\s*rn?$/i.test(h.trim()))
      const hasChemCol   = headers.some((h) => /chemnam|generic\s*name|chemical/i.test(h))
      const hasPmn       = headers.some((h) => /^pmnno$/i.test(h.trim()))
      if (!hasCasCol && !hasChemCol && !hasPmn) {
        return NextResponse.json({
          error: "This doesn't look like a TSCA file — expected 'CASRN'/'ChemNam' (TSCAINV_) or 'PMNNO'/'GenericName' (PMNACC_). Did you select the wrong source?",
        }, { status: 400 })
      }
    } else if (source === "aicis") {
      const { headers, rows } = parseExcelBuffer(buffer, 1)
      entries = parseAicisRows(headers, rows)
      // Validate: AICIS file must have CR No. or AICIS Approved Chemical Name column.
      const hasCrCol    = headers.some((h) => /^cr\s*no/i.test(h))
      const hasAicisCol = headers.some((h) => /aicis/i.test(h))
      if (!hasCrCol && !hasAicisCol) {
        return NextResponse.json({
          error: "This doesn't look like an AICIS Inventory file — expected columns 'CR No.' and 'AICIS Approved Chemical Name' were not found. Did you select the wrong source?",
        }, { status: 400 })
      }
    } else {
      return NextResponse.json({ error: `Source "${source}" not supported` }, { status: 400 })
    }

    if (entries.length === 0) {
      return NextResponse.json({
        error: "No valid rows found after parsing. Check that you selected the correct source for this file.",
      }, { status: 400 })
    }

    return NextResponse.json({ entries })
  }

  // action=commit: import selected rows to DB
  if (action === "commit") {
    const previewRaw  = formData.get("preview")
    const entriesRaw  = formData.get("entries")
    const selectedRaw = formData.get("selected_rows")
    if (!previewRaw || !entriesRaw || !selectedRaw) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const preview      = JSON.parse(previewRaw as string) as RegulatoryListPreview
    const entries      = JSON.parse(entriesRaw as string) as AicisEntry[]
    const selectedRows = JSON.parse(selectedRaw as string) as number[]

    const result = await commitAicisImport(preview, entries, selectedRows)
    return NextResponse.json(result)
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 })
}

export const dynamic = "force-dynamic"
