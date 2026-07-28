import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requirePermissionOrSuperAdmin } from "@/lib/auth-helpers"
import { pruneCandidateDocuments } from "@/lib/storage/cv-storage"
import { z } from "zod"

const mergeSchema = z.object({
  primary_id: z.string().uuid(),
  duplicate_id: z.string().uuid(),
})

// POST /api/recruitment/candidates/merge
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await requirePermissionOrSuperAdmin(supabase, user.id, "recruitment.candidates.merge"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const parsed = mergeSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin.schema("recruitment") as any)
    .rpc("merge_candidates", {
      p_primary_id: parsed.data.primary_id,
      p_duplicate_id: parsed.data.duplicate_id,
      p_merged_by: user.id,
    })

  if (error) return NextResponse.json({ error: error.message }, { status: 409 })

  // Repointing the duplicate's document history onto the primary can push
  // it past the 3-per-type limit — the RPC can delete the excess rows in
  // SQL but can't reach the Storage API to delete the underlying files, so
  // that cleanup happens here instead.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recruitment = admin.schema("recruitment") as any
  await Promise.all([
    pruneCandidateDocuments(recruitment, parsed.data.primary_id, "cv"),
    pruneCandidateDocuments(recruitment, parsed.data.primary_id, "cl"),
  ])

  return NextResponse.json(data?.[0] ?? data)
}
