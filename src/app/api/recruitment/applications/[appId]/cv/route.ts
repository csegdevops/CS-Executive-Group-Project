import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { hasModuleAccessForUser } from "@/lib/auth-helpers"
import { buildCvDownloadResponse } from "@/lib/storage/cv-storage"

// GET /api/recruitment/applications/[appId]/cv?type=cv|cl
export async function GET(req: NextRequest, { params }: { params: Promise<{ appId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await hasModuleAccessForUser(supabase, user.id, "recruitment"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { appId } = await params
  const docType = req.nextUrl.searchParams.get("type") === "cl" ? "cl" : "cv"

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: app } = await (admin.schema("recruitment") as any)
    .from("applications")
    .select("candidate_id, cv_storage_key, cl_storage_key")
    .eq("id", appId)
    .single()
  if (!app) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const storageKey = docType === "cv" ? app.cv_storage_key : app.cl_storage_key
  if (!storageKey) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: candidate } = await (admin.schema("recruitment") as any)
    .from("candidates")
    .select("first_name, last_name")
    .eq("id", app.candidate_id)
    .single()

  return buildCvDownloadResponse(storageKey, candidate?.first_name ?? null, candidate?.last_name ?? null, docType)
}
