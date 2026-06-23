import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { parseExcelBuffer } from "@/lib/import/excel-parser"
import { parseAicisRows } from "@/lib/import/aicis-parser"
import {
  generateAicisPreview,
  commitAicisImport,
} from "@/lib/import/regulatory-list-pipeline"
import type { RegulatoryListPreview } from "@/lib/import/regulatory-list-pipeline"
import type { AicisEntry } from "@/lib/import/aicis-parser"

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

function streamPreview(entries: AicisEntry[]) {
  return new ReadableStream({
    async start(controller) {
      try {
        const preview = await generateAicisPreview(entries, async (done, total) => {
          controller.enqueue(ndjson({ type: "progress", done, total }))
        })
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
  preview: RegulatoryListPreview,
  entries: AicisEntry[],
  selectedRows: number[]
) {
  return new ReadableStream({
    async start(controller) {
      try {
        const result = await commitAicisImport(preview, entries, selectedRows, async (done, total) => {
          controller.enqueue(ndjson({ type: "progress", done, total }))
        })
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
      if (body.source !== "aicis") {
        return NextResponse.json({ error: `Source "${body.source}" not supported yet` }, { status: 400 })
      }
      if (!Array.isArray(body.entries)) {
        return NextResponse.json({ error: "entries array required" }, { status: 400 })
      }
      return new Response(streamPreview(body.entries), { headers: streamHeaders })
    }

    if (body.action === "commit") {
      if (!body.preview || !Array.isArray(body.entries) || !Array.isArray(body.selectedRows)) {
        return NextResponse.json({ error: "preview, entries, and selectedRows required" }, { status: 400 })
      }
      return new Response(streamCommit(body.preview, body.entries, body.selectedRows), { headers: streamHeaders })
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
    if (source !== "aicis") {
      return NextResponse.json({ error: `Source "${source}" not supported yet` }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const { headers, rows } = parseExcelBuffer(buffer, 1)
    const entries = parseAicisRows(headers, rows)

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
