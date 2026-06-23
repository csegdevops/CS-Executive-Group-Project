import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { parseExcelBuffer } from "@/lib/import/excel-parser"
import { autoDetectMapping, applyMapping } from "@/lib/import/column-mapper"
import { generateImportPreview, commitImport } from "@/lib/import/import-pipeline"
import type { ColumnMapping } from "@/lib/import/column-mapper"
import type { RegulatoryFramework } from "@/types/database"

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const formData = await request.formData()
  const action = formData.get("action") as "preview" | "commit"
  const consultationId = formData.get("consultation_id") as string

  if (!consultationId) {
    return NextResponse.json({ error: "consultation_id required" }, { status: 400 })
  }

  // Verify consultation exists and get frameworks
  const { data: consultation } = await supabase
    .schema("regulatory")
    .from("consultations")
    .select("id, frameworks")
    .eq("id", consultationId)
    .single()

  if (!consultation) {
    return NextResponse.json({ error: "Consultation not found" }, { status: 404 })
  }

  const frameworks = (consultation.frameworks ?? []) as RegulatoryFramework[]

  if (action === "preview") {
    const file = formData.get("file") as File | null
    if (!file) return NextResponse.json({ error: "file required" }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const { headers, rows } = parseExcelBuffer(buffer)

    const mappingRaw = formData.get("column_mapping")
    const mapping: ColumnMapping = mappingRaw
      ? JSON.parse(mappingRaw as string)
      : autoDetectMapping(headers)

    const entries = applyMapping(rows, mapping)
    const preview = await generateImportPreview(entries, frameworks)

    return NextResponse.json({ headers, mapping, preview })
  }

  if (action === "commit") {
    const previewRaw = formData.get("preview")
    const selectedRaw = formData.get("selected_rows")
    if (!previewRaw || !selectedRaw) {
      return NextResponse.json({ error: "preview and selected_rows required" }, { status: 400 })
    }

    const preview = JSON.parse(previewRaw as string)
    const selectedRows = JSON.parse(selectedRaw as string) as number[]

    const result = await commitImport(preview, consultationId, selectedRows)
    return NextResponse.json(result)
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 })
}
