import { NextRequest, NextResponse, after } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requirePermissionOrSuperAdmin } from "@/lib/auth-helpers"
import { ingestCv } from "@/lib/cv-parsing/ingest"

// POST /api/recruitment/candidates/[candidateId]/documents — multipart
// upload (recruiter attaching a CV/cover letter on behalf of a candidate
// who applied by phone, email, or in person). Shares the same 3-document
// rolling window as application-driven uploads.
export async function POST(req: NextRequest, { params }: { params: Promise<{ candidateId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await requirePermissionOrSuperAdmin(supabase, user.id, "recruitment.candidates.edit"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

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
