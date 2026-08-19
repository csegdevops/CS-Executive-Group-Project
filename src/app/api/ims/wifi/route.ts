import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requirePermissionOrSuperAdmin } from "@/lib/auth-helpers"
import { NextResponse } from "next/server"
import { z } from "zod"

const createSchema = z.object({
  ssid:                          z.string().min(1),
  location:                      z.string().optional(),
  router_make:                   z.string().optional(),
  router_model:                  z.string().optional(),
  router_management_ip:          z.string().optional(),
  router_admin_username:         z.string().optional(),
  wifi_password_vault_reference: z.string().optional(),
  router_admin_vault_reference:  z.string().optional(),
  last_rotated_at:               z.string().optional(),
  notes:                         z.string().optional(),
})

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data, error } = await supabase
    .schema("ims")
    .from("wifi_networks")
    .select("*")
    .order("ssid")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!(await requirePermissionOrSuperAdmin(supabase, user.id, "ims.network.manage"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await request.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .schema("ims")
    .from("wifi_networks")
    .insert({ ...parsed.data, created_by: user.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
