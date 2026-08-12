import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requirePermissionOrSuperAdmin } from "@/lib/auth-helpers"
import { uploadJobFile } from "@/lib/storage/job-storage"

// POST /api/recruitment/jobs/[jobId]/documents — multipart upload of a
// candidate information pack (or any other supporting document) for an
// executive-search job. Mirrors the candidate_documents upload pattern
// (src/app/api/recruitment/candidates/[candidateId]/documents/route.ts) but
// with no retention cap — info packs are few and intentional, not repeated
// re-uploads.
export async function POST(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await requirePermissionOrSuperAdmin(supabase, user.id, "recruitment.jobs.edit"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { jobId } = await params
  const formData = await req.formData()
  const file = formData.get("file")

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const ext = file.name.split(".").pop() || "bin"
  const path = `jobs/${jobId}/${crypto.randomUUID()}.${ext}`

  const { storageKey } = await uploadJobFile({ path, buffer, mimeType: file.type || "application/octet-stream" })

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin.schema("recruitment") as any)
    .from("job_documents")
    .insert({ job_id: jobId, storage_key: storageKey, original_name: file.name })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
