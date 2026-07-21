import { NextRequest, NextResponse, after } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { ingestCv } from "@/lib/cv-parsing/ingest"
import { deleteCvFile } from "@/lib/storage/cv-storage"

// POST /api/recruitment/candidates/[candidateId]/cv — multipart upload
// (recruiter attaching a CV/cover letter on behalf of a candidate who
// applied by phone, email, or in person)
export async function POST(req: NextRequest, { params }: { params: Promise<{ candidateId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { candidateId } = await params

  const formData = await req.formData()
  const file = formData.get("file")
  const docType = formData.get("type") === "cl" ? "cl" : "cv"

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  // Runs after the response is sent — the Gemini call can take several
  // seconds and must not block this request. after() (not a bare
  // fire-and-forget promise) keeps the invocation alive on serverless
  // platforms until this settles.
  after(() =>
    ingestCv({
      candidateId,
      docType,
      source: { buffer, mimeType: file.type || "application/octet-stream", originalName: file.name },
    }).catch((err) => console.error("[cv-upload] ingest failed", err))
  )

  return NextResponse.json({ ok: true })
}

// DELETE /api/recruitment/candidates/[candidateId]/cv?type=cv|cl
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ candidateId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { candidateId } = await params
  const docType = req.nextUrl.searchParams.get("type") === "cl" ? "cl" : "cv"

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recruitment = admin.schema("recruitment") as any

  const { data: candidate } = await recruitment
    .from("candidates")
    .select("cv_storage_key, cl_storage_key")
    .eq("id", candidateId)
    .single()

  const storageKey = docType === "cv" ? candidate?.cv_storage_key : candidate?.cl_storage_key
  if (!storageKey) {
    return NextResponse.json({ error: "No file on file for this candidate" }, { status: 400 })
  }

  await deleteCvFile(storageKey)

  // Deleting the CV also clears the parse it produced — stale
  // education/work-experience data referencing a file that no longer
  // exists would be confusing. Manually curated skills/education tags are
  // left alone since they're now standalone profile data, not tied to
  // the file's existence.
  const update = docType === "cv"
    ? {
        cv_storage_key: null,
        cv_original_name: null,
        raw_resume_text: null,
        parsed_metadata: null,
        cv_parse_status: "unparsed",
        cv_parsed_by: null,
        cv_parsed_at: null,
      }
    : { cl_storage_key: null, cl_original_name: null }

  const { error } = await recruitment.from("candidates").update(update).eq("id", candidateId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
