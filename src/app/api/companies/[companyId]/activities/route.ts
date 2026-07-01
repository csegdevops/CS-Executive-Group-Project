import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { z } from "zod"

const createSchema = z.object({
  activity_type:    z.enum(["call", "email", "meeting", "note"]),
  subject:          z.string().min(1),
  body:             z.string().optional().nullable(),
  contact_id:       z.string().uuid().optional().nullable(),
  occurred_at:      z.string().optional(),
  linked_module:    z.enum(["regulatory", "recruitment", "crm"]).optional().nullable(),
  linked_record_id: z.string().uuid().optional().nullable(),
})

// GET /api/companies/[companyId]/activities
export async function GET(req: NextRequest, { params }: { params: Promise<{ companyId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { companyId } = await params
  const { searchParams } = req.nextUrl
  const limit = parseInt(searchParams.get("limit") ?? "50")

  const admin = createAdminClient()
  const { data: activities, error } = await admin
    .from("company_activities")
    .select("*")
    .eq("company_id", companyId)
    .order("occurred_at", { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Hydrate performer and contact names
  const performerIds = [...new Set((activities ?? []).map((a: { performed_by: string }) => a.performed_by))] as string[]
  const contactIds   = [...new Set((activities ?? []).map((a: { contact_id: string | null }) => a.contact_id).filter(Boolean))] as string[]

  const [{ data: profiles }, { data: contacts }] = await Promise.all([
    performerIds.length ? admin.from("profiles").select("id, full_name").in("id", performerIds) : { data: [] },
    contactIds.length   ? admin.from("contacts").select("id, first_name, last_name").in("id", contactIds) : { data: [] },
  ])

  const profileMap = Object.fromEntries((profiles ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name]))
  const contactMap = Object.fromEntries((contacts ?? []).map((c: { id: string; first_name: string; last_name: string }) => [c.id, `${c.first_name} ${c.last_name}`]))

  return NextResponse.json((activities ?? []).map((a: Record<string, unknown>) => ({
    ...a,
    performer_name: profileMap[a.performed_by as string] ?? null,
    contact_name: a.contact_id ? (contactMap[a.contact_id as string] ?? null) : null,
  })))
}

// POST /api/companies/[companyId]/activities
export async function POST(req: NextRequest, { params }: { params: Promise<{ companyId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { companyId } = await params
  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("company_activities")
    .insert({ ...parsed.data, company_id: companyId, performed_by: user.id })
    .select("*")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ...data, performer_name: null, contact_name: null }, { status: 201 })
}
