import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { hasModuleAccessForUser } from "@/lib/auth-helpers"

// POST /api/recruitment/applications/[appId]/view — record that the current
// user has opened this application. First view only: the (application_id,
// viewed_by) primary key makes this idempotent, so reopening never adds a
// row or moves viewed_at. Returns created: true only the first time, so the
// caller (ApplicationDetailSheet) knows whether to refresh the list — no
// point re-fetching the whole list on every reopen of an already-viewed
// application.
export async function POST(req: NextRequest, { params }: { params: Promise<{ appId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await hasModuleAccessForUser(supabase, user.id, "recruitment"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { appId } = await params
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recruitment = admin.schema("recruitment") as any

  const { data, error } = await recruitment
    .from("application_views")
    .upsert(
      { application_id: appId, viewed_by: user.id },
      { onConflict: "application_id,viewed_by", ignoreDuplicates: true }
    )
    .select("application_id")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // ignoreDuplicates upserts return no row when the conflict was hit — an
  // empty result means this recruiter had already viewed it before.
  return NextResponse.json({ created: (data ?? []).length > 0 })
}
