import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { z } from "zod"

const createSchema = z.object({
  company_id:           z.string().uuid(),
  contact_id:           z.string().uuid().optional().nullable(),
  title:                z.string().min(1),
  stage:                z.enum(["lead", "qualified", "proposal", "negotiation", "won", "lost"]).default("lead"),
  value:                z.number().positive().optional().nullable(),
  currency:             z.string().default("AUD"),
  module:               z.enum(["regulatory", "recruitment", "both"]).optional().nullable(),
  assigned_to:          z.string().uuid().optional().nullable(),
  expected_close_date:  z.string().optional().nullable(),
  notes:                z.string().optional().nullable(),
})

// GET /api/crm/opportunities?stage=lead,qualified&company_id=...
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = req.nextUrl
  const stageParam = searchParams.get("stage")
  const companyId  = searchParams.get("company_id")
  const openOnly   = searchParams.get("open") === "1"

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient().schema("crm") as any
  let query = admin
    .from("opportunities")
    .select("*")
    .order("created_at", { ascending: false })

  if (stageParam) query = query.in("stage", stageParam.split(",").map((s: string) => s.trim()))
  if (companyId)  query = query.eq("company_id", companyId)
  if (openOnly)   query = query.not("stage", "in", '("won","lost")')

  const { data: opps, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Hydrate company + contact + assigned_to names
  const companyIds   = [...new Set((opps ?? []).map((o: { company_id: string }) => o.company_id))] as string[]
  const profileIds   = [...new Set((opps ?? []).map((o: { assigned_to: string | null }) => o.assigned_to).filter(Boolean))] as string[]
  const contactIds   = [...new Set((opps ?? []).map((o: { contact_id: string | null }) => o.contact_id).filter(Boolean))] as string[]

  const [{ data: companies }, { data: profiles }, { data: contacts }] = await Promise.all([
    companyIds.length ? createAdminClient().from("companies").select("id, name").in("id", companyIds) : { data: [] },
    profileIds.length ? createAdminClient().from("profiles").select("id, full_name").in("id", profileIds) : { data: [] },
    contactIds.length ? createAdminClient().from("contacts").select("id, first_name, last_name").in("id", contactIds) : { data: [] },
  ])

  const companyMap = Object.fromEntries((companies ?? []).map((c: { id: string; name: string }) => [c.id, c.name]))
  const profileMap = Object.fromEntries((profiles ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name]))
  const contactMap = Object.fromEntries((contacts ?? []).map((c: { id: string; first_name: string; last_name: string }) => [c.id, `${c.first_name} ${c.last_name}`]))

  return NextResponse.json((opps ?? []).map((o: Record<string, unknown>) => ({
    ...o,
    company_name:     companyMap[o.company_id as string] ?? null,
    assigned_to_name: o.assigned_to ? (profileMap[o.assigned_to as string] ?? null) : null,
    contact_name:     o.contact_id  ? (contactMap[o.contact_id as string]  ?? null) : null,
  })))
}

// POST /api/crm/opportunities
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (createAdminClient().schema("crm") as any)
    .from("opportunities")
    .insert({ ...parsed.data, created_by: user.id })
    .select("*")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
