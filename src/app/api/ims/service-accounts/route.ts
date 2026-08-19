import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requirePermissionOrSuperAdmin } from "@/lib/auth-helpers"
import { NextResponse } from "next/server"
import { z } from "zod"

const createSchema = z.object({
  service_name:     z.string().min(1),
  service_url:      z.string().optional(),
  account_username: z.string().optional(),
  assigned_to:      z.string().uuid().optional(),
  vault_reference:  z.string().optional(),
  last_rotated_at:  z.string().optional(),
  notes:            z.string().optional(),
})

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data, error } = await supabase
    .schema("ims")
    .from("service_accounts")
    .select("*")
    .order("service_name")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const assignedIds = [...new Set((data ?? []).map((s) => s.assigned_to).filter(Boolean))] as string[]
  const { data: profiles } = assignedIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", assignedIds)
    : { data: [] }
  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.full_name]))

  return NextResponse.json(
    (data ?? []).map((s) => ({ ...s, assigned_to_name: s.assigned_to ? profileMap[s.assigned_to] ?? null : null }))
  )
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!(await requirePermissionOrSuperAdmin(supabase, user.id, "ims.service_accounts.manage"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await request.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .schema("ims")
    .from("service_accounts")
    .insert({ ...parsed.data, created_by: user.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
