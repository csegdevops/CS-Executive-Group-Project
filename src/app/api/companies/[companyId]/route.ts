import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { z } from "zod"

const patchSchema = z.object({
  name:             z.string().min(1).optional(),
  abn:              z.string().optional().nullable(),
  country:          z.string().optional().nullable(),
  industry:         z.string().optional().nullable(),
  notes:            z.string().optional().nullable(),
  is_active:        z.boolean().optional(),
  account_owner_id: z.string().uuid().optional().nullable(),
  crm_status:       z.enum(["lead", "prospect", "client", "inactive"]).optional(),
  address_line1:    z.string().optional().nullable(),
  address_line2:    z.string().optional().nullable(),
  suburb:           z.string().optional().nullable(),
  state:            z.string().optional().nullable(),
  postcode:         z.string().optional().nullable(),
})

// GET /api/companies/[companyId]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ companyId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { companyId } = await params
  const admin = createAdminClient()

  const [
    { data: company },
    { data: contacts },
    { data: activities },
    { data: consultations },
    { data: jobs },
    { data: opportunities },
  ] = await Promise.all([
    admin.from("companies").select("*").eq("id", companyId).single(),
    admin.from("contacts").select("*").eq("company_id", companyId).eq("is_active", true).order("is_primary", { ascending: false }).order("last_name"),
    admin.from("company_activities").select("*").eq("company_id", companyId).order("occurred_at", { ascending: false }).limit(20),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin.schema("regulatory") as any).from("consultations").select("id, title, status, reference_number, due_date, created_at").eq("company_id", companyId).order("created_at", { ascending: false }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin.schema("recruitment") as any).from("jobs").select("id, title, status, reference_number, location, employment_type, created_at").eq("company_id", companyId).order("created_at", { ascending: false }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin.schema("crm") as any).from("opportunities").select("id, title, stage, value, currency, module, assigned_to, expected_close_date").eq("company_id", companyId).not("stage", "in", '("won","lost")'),
  ])

  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Hydrate activity performer names and contact names
  const profileIds = [...new Set([
    ...(activities ?? []).map((a: { performed_by: string }) => a.performed_by),
    company.account_owner_id,
    ...(opportunities ?? []).map((o: { assigned_to: string | null }) => o.assigned_to).filter(Boolean),
  ].filter(Boolean))] as string[]

  const { data: profiles } = profileIds.length
    ? await admin.from("profiles").select("id, full_name").in("id", profileIds)
    : { data: [] }
  const profileMap = Object.fromEntries((profiles ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name]))

  const contactMap = Object.fromEntries((contacts ?? []).map((c: { id: string; first_name: string; last_name: string }) => [c.id, `${c.first_name} ${c.last_name}`]))

  return NextResponse.json({
    ...company,
    account_owner_name: company.account_owner_id ? (profileMap[company.account_owner_id] ?? null) : null,
    contacts: contacts ?? [],
    activities: (activities ?? []).map((a: Record<string, unknown>) => ({
      ...a,
      performer_name: profileMap[a.performed_by as string] ?? null,
      contact_name: a.contact_id ? (contactMap[a.contact_id as string] ?? null) : null,
    })),
    consultations: consultations ?? [],
    jobs: jobs ?? [],
    opportunities: (opportunities ?? []).map((o: Record<string, unknown>) => ({
      ...o,
      assigned_to_name: o.assigned_to ? (profileMap[o.assigned_to as string] ?? null) : null,
    })),
  })
}

// PATCH /api/companies/[companyId]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ companyId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { companyId } = await params
  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("companies")
    .update(parsed.data)
    .eq("id", companyId)
    .select("*")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
