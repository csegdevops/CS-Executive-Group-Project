import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { hasModuleAccessForUser, requirePermissionOrSuperAdmin } from "@/lib/auth-helpers"
import { uploadCvBuffer, downloadCvBuffer, buildCvHtmlPreviewResponse } from "@/lib/storage/cv-storage"

// POST /api/recruitment/contracts/[contractId]/document — multipart upload
export async function POST(req: NextRequest, { params }: { params: Promise<{ contractId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await requirePermissionOrSuperAdmin(supabase, user.id, "recruitment.contracts.manage"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { contractId } = await params
  const formData = await req.formData()
  const file = formData.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const ext = file.name.split(".").pop() || "bin"
  const { storageKey } = await uploadCvBuffer({
    path: `contracts/${contractId}/document.${ext}`,
    buffer,
    mimeType: file.type || "application/octet-stream",
    originalName: file.name,
  })

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin.schema("recruitment") as any)
    .from("contracts")
    .update({ document_storage_key: storageKey, document_original_name: file.name })
    .eq("id", contractId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, document_original_name: file.name })
}

// GET /api/recruitment/contracts/[contractId]/document?disposition=inline|attachment
export async function GET(req: NextRequest, { params }: { params: Promise<{ contractId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await hasModuleAccessForUser(supabase, user.id, "recruitment"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { contractId } = await params
  const disposition = req.nextUrl.searchParams.get("disposition") === "inline" ? "inline" : "attachment"

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: contract } = await (admin.schema("recruitment") as any)
    .from("contracts")
    .select("document_storage_key, document_original_name")
    .eq("id", contractId)
    .single()
  if (!contract?.document_storage_key) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (disposition === "inline" && contract.document_storage_key.toLowerCase().endsWith(".docx")) {
    return buildCvHtmlPreviewResponse(contract.document_storage_key)
  }

  const { buffer, mimeType } = await downloadCvBuffer(contract.document_storage_key)
  const filename = contract.document_original_name || contract.document_storage_key.split("/").pop() || "contract"
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": mimeType,
      "Content-Disposition": `${disposition}; filename="${filename}"`,
    },
  })
}
