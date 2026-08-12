import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requirePermissionOrSuperAdmin, hasModuleAccessForUser } from "@/lib/auth-helpers"
import { downloadJobFile, deleteJobFile } from "@/lib/storage/job-storage"

// GET /api/recruitment/jobs/[jobId]/documents/[documentId] — download one
// information-pack document.
export async function GET(req: NextRequest, { params }: { params: Promise<{ jobId: string; documentId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await hasModuleAccessForUser(supabase, user.id, "recruitment"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { jobId, documentId } = await params
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: doc } = await (admin.schema("recruitment") as any)
    .from("job_documents")
    .select("storage_key, original_name")
    .eq("id", documentId)
    .eq("job_id", jobId)
    .single()

  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { buffer, mimeType } = await downloadJobFile(doc.storage_key)
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": mimeType,
      "Content-Disposition": `attachment; filename="${doc.original_name ?? "document"}"`,
    },
  })
}

// DELETE /api/recruitment/jobs/[jobId]/documents/[documentId] — remove one
// information-pack document.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ jobId: string; documentId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await requirePermissionOrSuperAdmin(supabase, user.id, "recruitment.jobs.edit"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { jobId, documentId } = await params
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: doc } = await (admin.schema("recruitment") as any)
    .from("job_documents")
    .select("id, storage_key")
    .eq("id", documentId)
    .eq("job_id", jobId)
    .single()

  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await deleteJobFile(doc.storage_key)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin.schema("recruitment") as any).from("job_documents").delete().eq("id", documentId)

  return NextResponse.json({ ok: true })
}
