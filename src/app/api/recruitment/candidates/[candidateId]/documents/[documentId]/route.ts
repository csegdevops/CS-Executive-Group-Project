import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requirePermissionOrSuperAdmin, hasModuleAccessForUser } from "@/lib/auth-helpers"
import { deleteCvFile, buildCvDownloadResponse } from "@/lib/storage/cv-storage"

// GET /api/recruitment/candidates/[candidateId]/documents/[documentId] —
// download one specific historical document (not necessarily the current one)
export async function GET(req: NextRequest, { params }: { params: Promise<{ candidateId: string; documentId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await hasModuleAccessForUser(supabase, user.id, "recruitment"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { candidateId, documentId } = await params
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recruitment = admin.schema("recruitment") as any

  const [{ data: doc }, { data: candidate }] = await Promise.all([
    recruitment
      .from("candidate_documents")
      .select("storage_key, doc_type")
      .eq("id", documentId)
      .eq("candidate_id", candidateId)
      .single(),
    recruitment.from("candidates").select("first_name, last_name").eq("id", candidateId).single(),
  ])

  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Rank among this candidate's retained documents of the same type,
  // newest-first (1 = current) — feeds the unified Resume_1/Resume_2/...
  // download filename, matching the "Resume 1"/"Resume 2" list labels.
  const { data: siblings } = await recruitment
    .from("candidate_documents")
    .select("id")
    .eq("candidate_id", candidateId)
    .eq("doc_type", doc.doc_type)
    .order("created_at", { ascending: false })
  const position = (siblings ?? []).findIndex((s: { id: string }) => s.id === documentId) + 1

  return buildCvDownloadResponse(doc.storage_key, candidate?.first_name ?? null, candidate?.last_name ?? null, doc.doc_type, position || 1)
}

// DELETE /api/recruitment/candidates/[candidateId]/documents/[documentId] —
// remove a specific document. If it was the newest of its doc_type (i.e.
// "current"), reset the candidate's CV parse output — whatever survives as
// the new newest, if anything, hasn't been parsed as current yet. There's
// nothing to "promote": current is always just whatever query returns the
// newest row now.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ candidateId: string; documentId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await requirePermissionOrSuperAdmin(supabase, user.id, "recruitment.candidates.edit"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { candidateId, documentId } = await params
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recruitment = admin.schema("recruitment") as any

  const { data: doc } = await recruitment
    .from("candidate_documents")
    .select("id, doc_type, storage_key, created_at")
    .eq("id", documentId)
    .eq("candidate_id", candidateId)
    .single()

  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { data: newest } = await recruitment
    .from("candidate_documents")
    .select("id")
    .eq("candidate_id", candidateId)
    .eq("doc_type", doc.doc_type)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const wasCurrent = newest?.id === doc.id

  await deleteCvFile(doc.storage_key)
  await recruitment.from("candidate_documents").delete().eq("id", documentId)

  if (wasCurrent && doc.doc_type === "cv") {
    // Mirrors the parse-output reset the old single-slot delete used to do —
    // stale education/work-experience data referencing a file that no
    // longer exists would be confusing. Manually curated skills/education
    // tags are left alone since they're now standalone profile data, not
    // tied to the file's existence.
    await recruitment
      .from("candidates")
      .update({
        raw_resume_text: null,
        parsed_metadata: null,
        cv_parse_status: "unparsed",
        cv_parsed_by: null,
        cv_parsed_at: null,
      })
      .eq("id", candidateId)
  }

  return NextResponse.json({ ok: true })
}
