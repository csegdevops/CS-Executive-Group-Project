import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { z } from "zod"

const patchSchema = z.object({
  stage: z.enum(["applied", "screening", "shortlisted", "interview_1", "interview_2", "reference_check", "offer", "placed", "withdrawn", "rejected"]).optional(),
  notes: z.string().optional(),
  cv_storage_key: z.string().optional(),
  cv_original_name: z.string().optional(),
  cl_storage_key: z.string().optional(),
  cl_original_name: z.string().optional(),
  stage_notes: z.string().optional(),  // attached to the stage history row
})

// GET /api/recruitment/applications/[appId]
export async function GET(req: NextRequest, { params }: { params: Promise<{ appId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { appId } = await params
  const admin = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: app, error } = await (admin.schema("recruitment") as any)
    .from("applications")
    .select("*")
    .eq("id", appId)
    .single()
  if (error || !app) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const [
    { data: candidate },
    { data: job },
    { data: history },
  ] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin.schema("recruitment") as any)
      .from("candidates")
      .select("id, first_name, last_name, email, phone, current_title, current_employer, location_city, location_state, skills_tags, security_clearance_level, profile_completeness_pct")
      .eq("id", app.candidate_id)
      .single(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin.schema("recruitment") as any)
      .from("jobs")
      .select("id, title, reference_number, company_id, status, employment_type, location")
      .eq("id", app.job_id)
      .single(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin.schema("recruitment") as any)
      .from("application_stage_history")
      .select("id, from_stage, to_stage, notes, changed_by, changed_at")
      .eq("application_id", appId)
      .order("changed_at", { ascending: true }),
  ])

  const { data: company } = job
    ? await admin.from("companies").select("id, name").eq("id", job.company_id).single()
    : { data: null }

  // Hydrate stage history changers
  const changerIds = [...new Set((history ?? []).filter((h: { changed_by: string | null }) => h.changed_by).map((h: { changed_by: string }) => h.changed_by))]
  const { data: changers } = changerIds.length
    ? await admin.from("profiles").select("id, full_name").in("id", changerIds as string[])
    : { data: [] }
  const changerMap = Object.fromEntries((changers ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name]))

  return NextResponse.json({
    ...app,
    candidate,
    job: job ? { ...job, company_name: company?.name ?? null } : null,
    stage_history: (history ?? []).map((h: Record<string, unknown>) => ({
      ...h,
      changer_name: h.changed_by ? changerMap[h.changed_by as string] ?? null : "System",
    })),
  })
}

// PATCH /api/recruitment/applications/[appId]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ appId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { appId } = await params
  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: current } = await (admin.schema("recruitment") as any)
    .from("applications")
    .select("stage")
    .eq("id", appId)
    .single()
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { stage_notes, ...updateFields } = parsed.data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updated, error } = await (admin.schema("recruitment") as any)
    .from("applications")
    .update(updateFields)
    .eq("id", appId)
    .select("id, stage, notes, updated_at")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // If stage changed, insert explicit history row with changed_by (trigger inserts with NULL)
  if (parsed.data.stage && parsed.data.stage !== current.stage) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin.schema("recruitment") as any)
      .from("application_stage_history")
      .insert({
        application_id: appId,
        from_stage: current.stage,
        to_stage: parsed.data.stage,
        changed_by: user.id,
        notes: stage_notes ?? null,
      })
  }

  return NextResponse.json(updated)
}
