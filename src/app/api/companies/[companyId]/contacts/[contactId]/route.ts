import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { z } from "zod"

const patchSchema = z.object({
  first_name:              z.string().min(1).optional(),
  last_name:               z.string().min(1).optional(),
  title:                   z.string().optional().nullable(),
  department:              z.string().optional().nullable(),
  email:                   z.string().email().optional().nullable(),
  phone:                   z.string().optional().nullable(),
  is_primary:              z.boolean().optional(),
  notes:                   z.string().optional().nullable(),
  branch_id:               z.string().uuid().optional().nullable(),
  is_crm_contact:          z.boolean().optional(),
  is_regulatory_contact:   z.boolean().optional(),
  is_recruitment_contact:  z.boolean().optional(),
  is_active:               z.boolean().optional(),
})

// PATCH /api/companies/[companyId]/contacts/[contactId]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ companyId: string; contactId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { companyId, contactId } = await params
  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const admin = createAdminClient()

  // If marking as primary, clear existing primary first
  if (parsed.data.is_primary) {
    await admin.from("contacts").update({ is_primary: false }).eq("company_id", companyId).eq("is_primary", true).neq("id", contactId)
  }

  const { data, error } = await admin
    .from("contacts")
    .update(parsed.data)
    .eq("id", contactId)
    .eq("company_id", companyId)
    .select("*")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(data)
}

// DELETE /api/companies/[companyId]/contacts/[contactId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ companyId: string; contactId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { companyId, contactId } = await params
  const admin = createAdminClient()

  const { error } = await admin
    .from("contacts")
    .delete()
    .eq("id", contactId)
    .eq("company_id", companyId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
