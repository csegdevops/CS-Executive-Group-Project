import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { z } from "zod"

const patchSchema = z.object({
  name:          z.string().min(1).optional(),
  address_line1: z.string().optional().nullable(),
  address_line2: z.string().optional().nullable(),
  suburb:        z.string().optional().nullable(),
  state:         z.string().optional().nullable(),
  postcode:      z.string().optional().nullable(),
  country:       z.string().optional().nullable(),
  is_head_office: z.boolean().optional(),
  is_active:     z.boolean().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ companyId: string; branchId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { companyId, branchId } = await params
  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const admin = createAdminClient()

  if (parsed.data.is_head_office) {
    await admin.from("company_branches")
      .update({ is_head_office: false })
      .eq("company_id", companyId)
      .neq("id", branchId)
  }

  const { data, error } = await admin
    .from("company_branches")
    .update(parsed.data)
    .eq("id", branchId)
    .eq("company_id", companyId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ companyId: string; branchId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { companyId, branchId } = await params
  const admin = createAdminClient()

  // Check that branch has no active contacts before deleting
  const { count } = await admin
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .eq("branch_id", branchId)
    .eq("is_active", true)

  if (count && count > 0) {
    return NextResponse.json(
      { error: `This branch has ${count} active contact(s). Reassign or deactivate them first.` },
      { status: 409 }
    )
  }

  // Soft-delete (is_active = false) — head office cannot be deleted
  const { data: branch } = await admin.from("company_branches").select("is_head_office").eq("id", branchId).single()
  if (branch?.is_head_office) {
    return NextResponse.json({ error: "Head Office cannot be deleted. Rename it instead." }, { status: 409 })
  }

  const { error } = await admin
    .from("company_branches")
    .update({ is_active: false })
    .eq("id", branchId)
    .eq("company_id", companyId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
