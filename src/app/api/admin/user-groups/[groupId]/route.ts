import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { allPermissionKeys } from "@/lib/permissions"
import { NextResponse } from "next/server"
import { z } from "zod"

const validKeys = allPermissionKeys()

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  permissionKeys: z.array(z.string().refine((k) => validKeys.includes(k))).optional(),
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await params
  const caller = await requireSuperAdminUser()
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await request.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: group } = await admin.from("user_groups").select("is_locked").eq("id", groupId).single()
  if (group?.is_locked) {
    return NextResponse.json({ error: "This group is locked and cannot be modified." }, { status: 403 })
  }

  if (parsed.data.name !== undefined || parsed.data.description !== undefined) {
    const { error } = await admin
      .from("user_groups")
      .update({
        ...(parsed.data.name !== undefined && { name: parsed.data.name }),
        ...(parsed.data.description !== undefined && { description: parsed.data.description }),
      })
      .eq("id", groupId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (parsed.data.permissionKeys !== undefined) {
    const { error: deleteError } = await admin
      .from("user_group_permissions")
      .delete()
      .eq("group_id", groupId)
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

    if (parsed.data.permissionKeys.length > 0) {
      const { error: insertError } = await admin
        .from("user_group_permissions")
        .insert(parsed.data.permissionKeys.map((permission_key) => ({ group_id: groupId, permission_key })))
      if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await params
  const caller = await requireSuperAdminUser()
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const admin = createAdminClient()

  const { data: group } = await admin.from("user_groups").select("is_locked").eq("id", groupId).single()
  if (group?.is_locked) {
    return NextResponse.json({ error: "This group is locked and cannot be deleted." }, { status: 403 })
  }

  const { error } = await admin.from("user_groups").delete().eq("id", groupId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
