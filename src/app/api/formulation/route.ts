import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { parseExcelBuffer } from "@/lib/import/excel-parser"
import { parseFormulationRows } from "@/lib/import/formulation-parser"
import { generateFormulationPreview } from "@/lib/import/formulation-pipeline"
import type { FormulationEntry } from "@/lib/import/formulation-parser"

const enc    = new TextEncoder()
const ndjson = (obj: object) => enc.encode(JSON.stringify(obj) + "\n")

const STREAM_HEADERS = {
  "Content-Type":      "application/x-ndjson",
  "Cache-Control":     "no-cache, no-store",
  "X-Accel-Buffering": "no",
}

async function getRegUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role === "super_admin") return user
  const { data: access } = await supabase
    .from("user_module_access")
    .select("id")
    .eq("user_id", user.id)
    .eq("module", "regulatory")
    .maybeSingle()
  return access ? user : null
}

export async function POST(request: Request) {
  const user = await getRegUser()
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const contentType = request.headers.get("content-type") ?? ""

  // FormData — parse Excel file (enables XHR upload progress tracking)
  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    if (!file) return NextResponse.json({ error: "file required" }, { status: 400 })

    try {
      const buffer   = Buffer.from(await file.arrayBuffer())
      const { headers, rows } = parseExcelBuffer(buffer)
      const entries  = parseFormulationRows(headers, rows)
      return NextResponse.json({ entries })
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Failed to parse file" },
        { status: 400 }
      )
    }
  }

  // JSON — stream preview using company_id (no consultation ID needed)
  const body = await request.json() as { company_id?: string; entries?: FormulationEntry[] }
  if (!body.company_id || !Array.isArray(body.entries)) {
    return NextResponse.json({ error: "company_id and entries required" }, { status: 400 })
  }

  const { company_id, entries } = body

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const preview = await generateFormulationPreview(
          entries,
          { consultationId: null, companyId: company_id },
          async (done, total) => {
            controller.enqueue(ndjson({ type: "progress", done, total }))
          }
        )
        controller.enqueue(ndjson({ type: "result", preview }))
      } catch (err) {
        controller.enqueue(ndjson({ type: "error", message: err instanceof Error ? err.message : "Unknown error" }))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, { headers: STREAM_HEADERS })
}

export const dynamic = "force-dynamic"
