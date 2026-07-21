import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { allPermissionKeys } from "@/lib/permissions"
import { NextResponse } from "next/server"
import { z } from "zod"

const validKeys = allPermissionKeys()

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  permissionKeys: z.array(z.string().refine((k) => validKeys.includes(k))),
})

async function requireSuperAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role !== "super_admin") return null
  return user
}

export async function GET() {
  const caller = await requireSuperAdminUser()
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const admin = createAdminClient()
  const [groupsRes, permsRes, membersRes] = await Promise.all([
    admin.from("user_groups").select("id, name, description, is_locked, created_at").order("name"),
    admin.from("user_group_permissions").select("group_id, permission_key"),
    admin.from("user_group_members").select("group_id"),
  ])

  if (groupsRes.error) return NextResponse.json({ error: groupsRes.error.message }, { status: 500 })

  const permsByGroup = new Map<string, string[]>()
  for (const row of permsRes.data ?? []) {
    const list = permsByGroup.get(row.group_id) ?? []
    list.push(row.permission_key)
    permsByGroup.set(row.group_id, list)
  }

  const memberCountByGroup = new Map<string, number>()
  for (const row of membersRes.data ?? []) {
    memberCountByGroup.set(row.group_id, (memberCountByGroup.get(row.group_id) ?? 0) + 1)
  }

  const groups = (groupsRes.data ?? []).map((g) => ({
    ...g,
    permissionKeys: permsByGroup.get(g.id) ?? [],
    memberCount: memberCountByGroup.get(g.id) ?? 0,
  }))

  return NextResponse.json(groups)
}

export async function POST(request: Request) {
  const caller = await requireSuperAdminUser()
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await request.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: group, error } = await admin
    .from("user_groups")
    .insert({ name: parsed.data.name, description: parsed.data.description ?? null, created_by: caller.id })
    .select("id")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (parsed.data.permissionKeys.length > 0) {
    const { error: permError } = await admin
      .from("user_group_permissions")
      .insert(parsed.data.permissionKeys.map((permission_key) => ({ group_id: group.id, permission_key })))
    if (permError) return NextResponse.json({ error: permError.message }, { status: 500 })
  }

  return NextResponse.json({ id: group.id }, { status: 201 })
}
