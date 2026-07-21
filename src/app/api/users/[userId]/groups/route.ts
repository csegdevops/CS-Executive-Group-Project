import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"
import { z } from "zod"

const bodySchema = z.object({
  group_id: z.string().uuid(),
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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params
  const caller = await requireSuperAdminUser()
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("user_group_members")
    .select("group_id")
    .eq("user_id", userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params
  const caller = await requireSuperAdminUser()
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await request.json()
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: group } = await admin.from("user_groups").select("is_locked").eq("id", parsed.data.group_id).single()
  if (group?.is_locked) {
    return NextResponse.json({ error: "Super Admin membership is managed automatically via role, not group assignment." }, { status: 403 })
  }

  const { error } = await admin
    .from("user_group_members")
    .upsert(
      { user_id: userId, group_id: parsed.data.group_id, granted_by: caller.id },
      { onConflict: "group_id,user_id" }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params
  const caller = await requireSuperAdminUser()
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await request.json()
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: group } = await admin.from("user_groups").select("is_locked").eq("id", parsed.data.group_id).single()
  if (group?.is_locked) {
    return NextResponse.json({ error: "Super Admin membership is managed automatically via role, not group assignment." }, { status: 403 })
  }

  const { error } = await admin
    .from("user_group_members")
    .delete()
    .eq("user_id", userId)
    .eq("group_id", parsed.data.group_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
