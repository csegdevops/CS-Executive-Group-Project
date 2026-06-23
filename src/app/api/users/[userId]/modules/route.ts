import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"
import { z } from "zod"
import type { Module, ModuleAccessLevel } from "@/types/database"

const putSchema = z.object({
  module: z.enum(["regulatory", "recruitment", "crm"]),
  access_level: z.enum(["admin", "member"]),
})

const deleteSchema = z.object({
  module: z.enum(["regulatory", "recruitment", "crm"]),
})

async function getCallerContext(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single()
  return { user, isSuperAdmin: profile?.role === "super_admin" }
}

async function callerHasModuleAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  module: string
) {
  const { data } = await supabase
    .from("user_module_access")
    .select("access_level")
    .eq("user_id", userId)
    .eq("module", module)
    .single()
  return data?.access_level === "admin"
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params
  const supabase = await createClient()
  const ctx = await getCallerContext(supabase)
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { user, isSuperAdmin } = ctx
  if (!isSuperAdmin) {
    const { data: anyAdmin } = await supabase
      .from("user_module_access")
      .select("access_level")
      .eq("user_id", user.id)
      .eq("access_level", "admin")
      .limit(1)
    if (!anyAdmin?.length) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { data, error } = await supabase
    .from("user_module_access")
    .select("module, access_level, granted_at")
    .eq("user_id", userId)
    .order("module")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params
  const supabase = await createClient()
  const ctx = await getCallerContext(supabase)
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { user, isSuperAdmin } = ctx

  const body = await request.json()
  const parsed = putSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { module, access_level } = parsed.data

  // Non-super-admins can only modify the modules they themselves admin
  if (!isSuperAdmin) {
    const isModuleAdmin = await callerHasModuleAdmin(supabase, user.id, module)
    if (!isModuleAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from("user_module_access")
    .upsert(
      {
        user_id: userId,
        module: module as Module,
        access_level: access_level as ModuleAccessLevel,
        granted_by: user.id,
      },
      { onConflict: "user_id,module" }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params
  const supabase = await createClient()
  const ctx = await getCallerContext(supabase)
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { user, isSuperAdmin } = ctx

  const body = await request.json()
  const parsed = deleteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // Non-super-admins can only revoke access for modules they themselves admin
  if (!isSuperAdmin) {
    const isModuleAdmin = await callerHasModuleAdmin(supabase, user.id, parsed.data.module)
    if (!isModuleAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from("user_module_access")
    .delete()
    .eq("user_id", userId)
    .eq("module", parsed.data.module)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
