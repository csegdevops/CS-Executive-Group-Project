import { NextRequest, NextResponse, after } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requirePermissionOrSuperAdmin } from "@/lib/auth-helpers"
import { downloadCvBuffer } from "@/lib/storage/cv-storage"
import { parseCandidateCv } from "@/lib/cv-parsing/parse-candidate"

// POST /api/recruitment/candidates/[candidateId]/parse-cv — re-run parsing
// on the CV already on file (no new upload). Used for retrying after a
// failure or forcing a re-parse.
export async function POST(req: NextRequest, { params }: { params: Promise<{ candidateId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await requirePermissionOrSuperAdmin(supabase, user.id, "recruitment.candidates.edit"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { candidateId } = await params
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recruitment = admin.schema("recruitment") as any

  const { data: currentCv } = await recruitment
    .from("candidate_documents")
    .select("storage_key")
    .eq("candidate_id", candidateId)
    .eq("doc_type", "cv")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!currentCv?.storage_key) {
    return NextResponse.json({ error: "No CV on file for this candidate" }, { status: 400 })
  }

  await recruitment
    .from("candidates")
    .update({ cv_parse_status: "pending" })
    .eq("id", candidateId)

  console.log(`[parse-cv] ${candidateId} registering after() callback`)
  after(async () => {
    console.log(`[parse-cv] ${candidateId} after() callback started`)
    try {
      const { buffer, mimeType } = await downloadCvBuffer(currentCv.storage_key)
      console.log(`[parse-cv] ${candidateId} downloaded ${buffer.length} bytes, mimeType=${mimeType}`)
      await parseCandidateCv(candidateId, buffer, mimeType)
      console.log(`[parse-cv] ${candidateId} parseCandidateCv resolved`)
    } catch (err) {
      console.error(`[parse-cv] ${candidateId} failed`, err)
    }
  })
  console.log(`[parse-cv] ${candidateId} after() registered, returning response`)

  return NextResponse.json({ ok: true })
}
