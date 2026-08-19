import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requirePermissionOrSuperAdmin } from "@/lib/auth-helpers"
import { z } from "zod"

const createSchema = z.object({
  login_username:  z.string().min(1),
  user_id:         z.string().uuid().optional(),
  login_type:      z.enum(["local", "domain", "microsoft_account", "other"]).optional(),
  vault_reference: z.string().optional(),
  last_rotated_at: z.string().optional(),
  notes:           z.string().optional(),
})

// POST /api/ims/computers/[computerId]/logins
export async function POST(req: NextRequest, { params }: { params: Promise<{ computerId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await requirePermissionOrSuperAdmin(supabase, user.id, "ims.computers.manage"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { computerId } = await params
  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .schema("ims")
    .from("computer_logins")
    .insert({ ...parsed.data, computer_id: computerId, created_by: user.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
