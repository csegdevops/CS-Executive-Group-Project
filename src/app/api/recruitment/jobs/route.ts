import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { z } from "zod"

const createJobSchema = z.object({
  company_id: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  requirements: z.string().optional(),
  employment_type: z.enum(["permanent", "contract", "casual", "full_time", "part_time"]).optional(),
  vacancies_count: z.number().int().min(1).default(1),
  location: z.string().optional(),
  salary_min: z.number().positive().optional(),
  salary_max: z.number().positive().optional(),
  salary_currency: z.string().default("AUD"),
  contract_duration_weeks: z.number().int().positive().optional(),
  security_clearance_required: z.boolean().default(false),
  reference_number: z.string().optional(),
})

// GET /api/recruitment/jobs?status=active&company_id=...&q=...&page=1
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = req.nextUrl
  const statusParam = searchParams.get("status")
  const companyId   = searchParams.get("company_id")
  const q           = searchParams.get("q")
  const recruiterId = searchParams.get("recruiter_id")

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient().schema("recruitment") as any
  let query = admin
    .from("jobs")
    .select(`
      id, title, reference_number, location, employment_type,
      status, security_clearance_required, salary_min, salary_max, salary_currency,
      created_at, updated_at,
      company_id, assigned_recruiter_id, created_by
    `)
    .order("created_at", { ascending: false })
    .limit(200)

  if (statusParam) {
    const statuses = statusParam.split(",").map(s => s.trim())
    query = query.in("status", statuses)
  }
  if (companyId)   query = query.eq("company_id", companyId)
  if (recruiterId) query = query.eq("assigned_recruiter_id", recruiterId)
  if (q)           query = query.ilike("title", `%${q}%`)

  const { data: jobs, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Hydrate company names
  const companyIds = [...new Set((jobs ?? []).map((j: { company_id: string }) => j.company_id))] as string[]
  const { data: companies } = companyIds.length
    ? await createAdminClient().from("companies").select("id, name").in("id", companyIds)
    : { data: [] }
  const companyMap = Object.fromEntries((companies ?? []).map((c: { id: string; name: string }) => [c.id, c.name]))

  // Hydrate recruiter names
  const recruiterIds = [...new Set((jobs ?? []).map((j: { assigned_recruiter_id: string | null }) => j.assigned_recruiter_id).filter(Boolean))]
  const { data: profiles } = recruiterIds.length
    ? await createAdminClient().from("profiles").select("id, full_name").in("id", recruiterIds as string[])
    : { data: [] }
  const profileMap = Object.fromEntries((profiles ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name]))

  // Application counts per job
  const jobIds = (jobs ?? []).map((j: { id: string }) => j.id)
  const { data: appCounts } = jobIds.length
    ? await (createAdminClient().schema("recruitment") as any)
        .from("applications")
        .select("job_id")
        .in("job_id", jobIds)
    : { data: [] }
  const countMap: Record<string, number> = {}
  for (const a of appCounts ?? []) {
    countMap[a.job_id] = (countMap[a.job_id] ?? 0) + 1
  }

  const result = (jobs ?? []).map((j: Record<string, unknown>) => ({
    ...j,
    company_name:     companyMap[j.company_id as string] ?? null,
    recruiter_name:   j.assigned_recruiter_id ? (profileMap[j.assigned_recruiter_id as string] ?? null) : null,
    application_count: countMap[j.id as string] ?? 0,
  }))

  return NextResponse.json(result)
}

// POST /api/recruitment/jobs
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = createJobSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const admin = createAdminClient()

  // Auto-generate reference_number if not provided
  let referenceNumber = parsed.data.reference_number
  if (!referenceNumber) {
    const year   = new Date().getFullYear()
    const prefix = `REC-${year}-`
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: last } = await (admin.schema("recruitment") as any)
      .from("jobs")
      .select("reference_number")
      .like("reference_number", `${prefix}%`)
      .order("reference_number", { ascending: false })
      .limit(1)
      .maybeSingle()
    const lastN = last?.reference_number
      ? parseInt((last.reference_number as string).slice(prefix.length), 10)
      : 0
    referenceNumber = `${prefix}${String((isNaN(lastN) ? 0 : lastN) + 1).padStart(3, "0")}`
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: job, error } = await (admin.schema("recruitment") as any)
    .from("jobs")
    .insert({ ...parsed.data, reference_number: referenceNumber, created_by: user.id, status: "opened" })
    .select("id, title, reference_number, status, created_at")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Log the opening event
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin.schema("recruitment") as any)
    .from("job_events")
    .insert({
      job_id: job.id,
      event_type: "opened",
      new_status: "opened",
      performed_by: user.id,
    })

  return NextResponse.json(job, { status: 201 })
}
