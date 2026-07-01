import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { z } from "zod"

const createSchema = z.object({
  first_name:              z.string().min(1),
  last_name:               z.string().min(1),
  title:                   z.string().optional().nullable(),
  department:              z.string().optional().nullable(),
  email:                   z.string().email().optional().nullable(),
  phone:                   z.string().optional().nullable(),
  is_primary:              z.boolean().default(false),
  notes:                   z.string().optional().nullable(),
  branch_id:               z.string().uuid().optional().nullable(),
  is_crm_contact:          z.boolean().default(true),
  is_regulatory_contact:   z.boolean().default(false),
  is_recruitment_contact:  z.boolean().default(false),
})

// GET /api/companies/[companyId]/contacts
export async function GET(_req: NextRequest, { params }: { params: Promise<{ companyId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { companyId } = await params
  const admin = createAdminClient()

  const { data, error } = await admin
    .from("contacts")
    .select("*")
    .eq("company_id", companyId)
    .order("is_primary", { ascending: false })
    .order("last_name")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/companies/[companyId]/contacts
export async function POST(req: NextRequest, { params }: { params: Promise<{ companyId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { companyId } = await params
  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const admin = createAdminClient()

  // If marking as primary, clear existing primary
  if (parsed.data.is_primary) {
    await admin.from("contacts").update({ is_primary: false }).eq("company_id", companyId).eq("is_primary", true)
  }

  const { data, error } = await admin
    .from("contacts")
    .insert({ ...parsed.data, company_id: companyId, added_by: user.id })
    .select("*")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
