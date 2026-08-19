import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requirePermissionOrSuperAdmin } from "@/lib/auth-helpers"
import { z } from "zod"

const patchSchema = z.object({
  login_username:  z.string().min(1).optional(),
  user_id:         z.string().uuid().optional().nullable(),
  login_type:      z.enum(["local", "domain", "microsoft_account", "other"]).optional(),
  vault_reference: z.string().optional().nullable(),
  last_rotated_at: z.string().optional().nullable(),
  notes:           z.string().optional().nullable(),
})

// PATCH /api/ims/computers/[computerId]/logins/[loginId]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ computerId: string; loginId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await requirePermissionOrSuperAdmin(supabase, user.id, "ims.computers.manage"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { computerId, loginId } = await params
  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .schema("ims")
    .from("computer_logins")
    .update(parsed.data)
    .eq("id", loginId)
    .eq("computer_id", computerId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/ims/computers/[computerId]/logins/[loginId]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ computerId: string; loginId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await requirePermissionOrSuperAdmin(supabase, user.id, "ims.computers.manage"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { computerId, loginId } = await params
  const admin = createAdminClient()
  const { error } = await admin
    .schema("ims")
    .from("computer_logins")
    .delete()
    .eq("id", loginId)
    .eq("computer_id", computerId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
