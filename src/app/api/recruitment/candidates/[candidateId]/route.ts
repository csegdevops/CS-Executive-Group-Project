import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { z } from "zod"

const patchSchema = z.object({
  first_name: z.string().min(1).optional(),
  last_name: z.string().min(1).optional(),
  phone: z.string().optional().nullable(),
  current_title: z.string().optional().nullable(),
  current_employer: z.string().optional().nullable(),
  location_city: z.string().optional().nullable(),
  location_state: z.string().optional().nullable(),
  skills_tags: z.array(z.string()).optional(),
  field_of_study: z.string().optional().nullable(),
  security_clearance_level: z.string().optional().nullable(),
  security_clearance_verified: z.boolean().optional(),
  security_clearance_expiry: z.string().optional().nullable(),
  is_active: z.boolean().optional(),
})

// GET /api/recruitment/candidates/[candidateId]
export async function GET(req: NextRequest, { params }: { params: Promise<{ candidateId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { candidateId } = await params
  const admin = createAdminClient()

  const [{ data: candidate, error }, { data: applications }] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin.schema("recruitment") as any)
      .from("candidates")
      .select("*")
      .eq("id", candidateId)
      .single(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin.schema("recruitment") as any)
      .from("applications")
      .select("id, job_id, stage, source_channel, created_at, cv_storage_key")
      .eq("candidate_id", candidateId)
      .order("created_at", { ascending: false }),
  ])

  if (error || !candidate) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Hydrate job info for applications
  const jobIds = [...new Set((applications ?? []).map((a: { job_id: string }) => a.job_id))]
  const { data: jobs } = jobIds.length
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin.schema("recruitment") as any)
        .from("jobs")
        .select("id, title, reference_number, company_id, status")
        .in("id", jobIds)
    : { data: [] }

  const companyIds = [...new Set((jobs ?? []).map((j: { company_id: string }) => j.company_id))] as string[]
  const { data: companies } = companyIds.length
    ? await admin.from("companies").select("id, name").in("id", companyIds)
    : { data: [] }

  const jobMap     = Object.fromEntries((jobs ?? []).map((j: Record<string, unknown>) => [j.id, j]))
  const companyMap = Object.fromEntries((companies ?? []).map((c: { id: string; name: string }) => [c.id, c.name]))

  return NextResponse.json({
    ...candidate,
    applications: (applications ?? []).map((a: Record<string, unknown>) => {
      const job = jobMap[a.job_id as string] as Record<string, unknown> | undefined
      return {
        ...a,
        job_title:     job?.title ?? null,
        job_reference: job?.reference_number ?? null,
        job_status:    job?.status ?? null,
        company_name:  job ? companyMap[job.company_id as string] ?? null : null,
      }
    }),
  })
}

// PATCH /api/recruitment/candidates/[candidateId]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ candidateId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { candidateId } = await params
  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin.schema("recruitment") as any)
    .from("candidates")
    .update(parsed.data)
    .eq("id", candidateId)
    .select("id, first_name, last_name, email, profile_completeness_pct, updated_at")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
