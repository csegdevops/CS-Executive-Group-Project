import { createClient } from "@/lib/supabase/server"
import { logConsultationEvent } from "@/lib/consultation-log"
import { NextResponse } from "next/server"
import { parseExcelBuffer } from "@/lib/import/excel-parser"
import { parseFormulationRows } from "@/lib/import/formulation-parser"
import {
  generateFormulationPreview,
  commitFormulationUpload,
} from "@/lib/import/formulation-pipeline"
import type { FormulationPreview } from "@/lib/import/formulation-pipeline"
import type { FormulationEntry } from "@/lib/import/formulation-parser"

const enc     = new TextEncoder()
const ndjson  = (obj: object) => enc.encode(JSON.stringify(obj) + "\n")

const STREAM_HEADERS = {
  "Content-Type":   "application/x-ndjson",
  "Cache-Control":  "no-cache, no-store",
  "X-Accel-Buffering": "no",
}

async function verifyAccess(consultationId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Verify the user can read this consultation — RLS on consultations handles access control.
  // If the user lacks access, the query returns null and we reject the request.
  const { data: consultation } = await supabase
    .schema("regulatory")
    .from("consultations")
    .select("id")
    .eq("id", consultationId)
    .single()

  return consultation ? user : null
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ consultationId: string }> }
) {
  const { consultationId } = await params
  const caller = await verifyAccess(consultationId)
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const contentType = request.headers.get("content-type") ?? ""

  // JSON body → streaming preview or commit
  if (contentType.includes("application/json")) {
    const body = await request.json() as {
      action: "preview" | "commit"
      entries?: FormulationEntry[]
      preview?: FormulationPreview
      selectedRows?: number[]
    }

    if (body.action === "preview") {
      if (!Array.isArray(body.entries)) {
        return NextResponse.json({ error: "entries array required" }, { status: 400 })
      }
      const entries = body.entries
      const stream = new ReadableStream({
        async start(controller) {
          try {
            const preview = await generateFormulationPreview(entries, { consultationId }, async (done, total) => {
              controller.enqueue(ndjson({ type: "progress", done, total }))
            })
            controller.enqueue(ndjson({ type: "result", preview, entries }))
          } catch (err) {
            controller.enqueue(ndjson({ type: "error", message: err instanceof Error ? err.message : "Unknown error" }))
          } finally {
            controller.close()
          }
        },
      })
      return new Response(stream, { headers: STREAM_HEADERS })
    }

    if (body.action === "commit") {
      if (!body.preview || !Array.isArray(body.entries) || !Array.isArray(body.selectedRows)) {
        return NextResponse.json({ error: "preview, entries, and selectedRows required" }, { status: 400 })
      }
      const { preview, entries, selectedRows } = body
      const stream = new ReadableStream({
        async start(controller) {
          try {
            const result = await commitFormulationUpload(preview, entries, selectedRows, consultationId, async (done, total) => {
              controller.enqueue(ndjson({ type: "progress", done, total }))
            })
            controller.enqueue(ndjson({ type: "result", ...result }))
            await logConsultationEvent(consultationId, caller.id, "chemicals_added", {
              added:      result.added,
              unresolved: result.unresolved,
            })
          } catch (err) {
            controller.enqueue(ndjson({ type: "error", message: err instanceof Error ? err.message : "Unknown error" }))
          } finally {
            controller.close()
          }
        },
      })
      return new Response(stream, { headers: STREAM_HEADERS })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  }

  // FormData body → parse Excel file (phase 1, enables XHR upload progress)
  const formData  = await request.formData()
  const action    = formData.get("action") as string
  if (action !== "parse") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  }

  const file = formData.get("file") as File | null
  if (!file) return NextResponse.json({ error: "file required" }, { status: 400 })

  try {
    const buffer  = Buffer.from(await file.arrayBuffer())
    const { headers, rows } = parseExcelBuffer(buffer)
    const entries = parseFormulationRows(headers, rows)
    return NextResponse.json({ entries })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to parse file" },
      { status: 400 }
    )
  }
}

export const dynamic = "force-dynamic"
