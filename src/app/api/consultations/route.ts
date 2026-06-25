import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { logConsultationEvent } from "@/lib/consultation-log"
import { NextResponse } from "next/server"
import { z } from "zod"

const createSchema = z.object({
  company_id: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  frameworks: z.array(z.enum(["aicis", "reach", "tsca"])).min(1),
  reference_number: z.string().optional(),
  due_date: z.string().optional(),
})

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const companyId    = searchParams.get("company_id")
  const statusParam  = searchParams.get("status") // comma-separated list

  const reg = supabase.schema("regulatory")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (reg as any)
    .from("consultations")
    .select("id, company_id, title, status, due_date, updated_at, frameworks, reference_number")
    .order("due_date", { ascending: true, nullsFirst: false })

  if (companyId) query = query.eq("company_id", companyId)
  if (statusParam) {
    const statuses = statusParam.split(",").map((s) => s.trim()).filter(Boolean)
    if (statuses.length === 1) query = query.eq("status", statuses[0])
    else if (statuses.length > 1) query = query.in("status", statuses)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Resolve company names separately — cross-schema join (regulatory → public) is unreliable
  const rawData = (data ?? []) as { company_id: string; [k: string]: unknown }[]
  const companyIds = [...new Set(rawData.map((c) => c.company_id).filter(Boolean))]
  const { data: companiesData } = companyIds.length
    ? await supabase.from("companies").select("id, name").in("id", companyIds)
    : { data: [] }
  const companyMap = new Map((companiesData ?? []).map((c) => [c.id, { id: c.id, name: c.name }]))

  const result = rawData.map((c) => ({
    ...c,
    companies: companyMap.get(c.company_id) ?? null,
  }))

  return NextResponse.json(result)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Any regulatory module member (or super_admin) may create consultations
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role !== "super_admin") {
    const { data: access } = await supabase
      .from("user_module_access")
      .select("id")
      .eq("user_id", user.id)
      .eq("module", "regulatory")
      .maybeSingle()
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await request.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const admin = createAdminClient()
  const reg   = admin.schema("regulatory")

  // Auto-generate reference_number if not provided
  let referenceNumber = parsed.data.reference_number
  if (!referenceNumber) {
    const year   = new Date().getFullYear()
    const prefix = `CS-${year}-`
    const { data: last } = await reg
      .from("consultations")
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

  const { data, error } = await reg
    .from("consultations")
    .insert({ ...parsed.data, reference_number: referenceNumber })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Add the creator to consultation_consultants so they can view and edit it
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (reg as any)
    .from("consultation_consultants")
    .insert({ consultation_id: data.id, consultant_id: user.id })

  await logConsultationEvent(data.id, user.id, "created", { title: data.title })

  return NextResponse.json(data, { status: 201 })
}
