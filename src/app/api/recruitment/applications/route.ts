import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { z } from "zod"

const createAppSchema = z.object({
  job_id: z.string().uuid(),
  candidate_id: z.string().uuid().optional(),
  // If no candidate_id, create/upsert candidate inline
  candidate_email: z.string().email().optional(),
  candidate_first_name: z.string().optional(),
  candidate_last_name: z.string().optional(),
  candidate_phone: z.string().optional(),
  source_channel: z.enum(["seek_inbound", "company_website", "database_internal", "seek_talent", "linkedin"]),
  source_metadata: z.record(z.string(), z.unknown()).optional(),
  cv_storage_key: z.string().optional(),
  cv_original_name: z.string().optional(),
  cl_storage_key: z.string().optional(),
  cl_original_name: z.string().optional(),
  notes: z.string().optional(),
}).refine(d => d.candidate_id || d.candidate_email, {
  message: "Either candidate_id or candidate_email must be provided",
})

// GET /api/recruitment/applications?job_id=...&stage=...&source=...&candidate_id=...
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = req.nextUrl
  const jobId       = searchParams.get("job_id")
  const stage       = searchParams.get("stage")
  const source      = searchParams.get("source")
  const candidateId = searchParams.get("candidate_id")

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (admin.schema("recruitment") as any)
    .from("applications")
    .select(`
      id, job_id, candidate_id, source_channel, stage,
      cv_storage_key, cv_original_name, notes,
      submitted_by, created_at, updated_at
    `)
    .order("created_at", { ascending: false })
    .limit(300)

  if (jobId)       query = query.eq("job_id", jobId)
  if (stage)       query = query.eq("stage", stage)
  if (source)      query = query.eq("source_channel", source)
  if (candidateId) query = query.eq("candidate_id", candidateId)

  const { data: apps, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Hydrate candidate names + job titles
  const candIds = [...new Set((apps ?? []).map((a: { candidate_id: string }) => a.candidate_id))]
  const jobIds  = [...new Set((apps ?? []).map((a: { job_id: string }) => a.job_id))]

  const [{ data: candidates }, { data: jobs }] = await Promise.all([
    candIds.length
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (admin.schema("recruitment") as any)
          .from("candidates")
          .select("id, first_name, last_name, email, current_title, profile_completeness_pct")
          .in("id", candIds)
      : Promise.resolve({ data: [] }),
    jobIds.length
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (admin.schema("recruitment") as any)
          .from("jobs")
          .select("id, title, reference_number, company_id")
          .in("id", jobIds)
      : Promise.resolve({ data: [] }),
  ])

  // Hydrate company names
  const companyIds = [...new Set((jobs ?? []).map((j: { company_id: string }) => j.company_id))] as string[]
  const { data: companies } = companyIds.length
    ? await admin.from("companies").select("id, name").in("id", companyIds)
    : { data: [] }

  const candMap     = Object.fromEntries((candidates ?? []).map((c: Record<string, unknown>) => [c.id, c]))
  const jobMap      = Object.fromEntries((jobs ?? []).map((j: Record<string, unknown>) => [j.id, j]))
  const companyMap  = Object.fromEntries((companies ?? []).map((c: { id: string; name: string }) => [c.id, c.name]))

  const result = (apps ?? []).map((a: Record<string, unknown>) => {
    const cand = candMap[a.candidate_id as string] as Record<string, unknown> | undefined
    const job  = jobMap[a.job_id as string] as Record<string, unknown> | undefined
    return {
      ...a,
      candidate_name: cand ? `${cand.first_name} ${cand.last_name}` : null,
      candidate_email: cand?.email ?? null,
      candidate_title: cand?.current_title ?? null,
      candidate_completeness: cand?.profile_completeness_pct ?? null,
      job_title: job?.title ?? null,
      job_reference: job?.reference_number ?? null,
      company_name: job ? companyMap[job.company_id as string] ?? null : null,
    }
  })

  return NextResponse.json(result)
}

// POST /api/recruitment/applications
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = createAppSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const admin = createAdminClient()
  let candidateId = parsed.data.candidate_id

  // Upsert candidate if only email provided
  if (!candidateId && parsed.data.candidate_email) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: upsertResult, error: upsertError } = await (admin.schema("recruitment") as any)
      .rpc("upsert_candidate", {
        p_email:      parsed.data.candidate_email,
        p_phone:      parsed.data.candidate_phone ?? null,
        p_first_name: parsed.data.candidate_first_name ?? null,
        p_last_name:  parsed.data.candidate_last_name ?? null,
        p_source_channel: parsed.data.source_channel,
        p_added_by:   user.id,
      })
    if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 })
    candidateId = upsertResult?.[0]?.candidate_id
  }

  if (!candidateId) return NextResponse.json({ error: "Could not resolve candidate" }, { status: 400 })

  // Check for duplicate application
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (admin.schema("recruitment") as any)
    .from("applications")
    .select("id, stage")
    .eq("job_id", parsed.data.job_id)
    .eq("candidate_id", candidateId)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ status: "duplicate_skipped", application_id: existing.id, stage: existing.stage }, { status: 200 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: app, error } = await (admin.schema("recruitment") as any)
    .from("applications")
    .insert({
      job_id:           parsed.data.job_id,
      candidate_id:     candidateId,
      source_channel:   parsed.data.source_channel,
      source_metadata:  parsed.data.source_metadata ?? null,
      cv_storage_key:   parsed.data.cv_storage_key ?? null,
      cv_original_name: parsed.data.cv_original_name ?? null,
      cl_storage_key:   parsed.data.cl_storage_key ?? null,
      cl_original_name: parsed.data.cl_original_name ?? null,
      notes:            parsed.data.notes ?? null,
      submitted_by:     user.id,
      stage: "applied",
    })
    .select("id, job_id, candidate_id, stage, source_channel, created_at")
    .single()

  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "Application already exists" }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Insert initial stage history row (trigger only fires on UPDATE)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin.schema("recruitment") as any)
    .from("application_stage_history")
    .insert({
      application_id: app.id,
      from_stage: null,
      to_stage: "applied",
      changed_by: user.id,
    })

  return NextResponse.json({ status: "created", application: app, candidate_id: candidateId }, { status: 201 })
}
