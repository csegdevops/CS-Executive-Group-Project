import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getUserPermissionKeys, isModuleAdmin } from "@/lib/auth-helpers"
import { isEmailPaused } from "@/lib/email/pause"
import { NextResponse } from "next/server"
import { z } from "zod"

const createSchema = z.object({
  email: z.string().email(),
  full_name: z.string().min(1),
  role: z.enum(["super_admin", "user"]).default("user"),
})

async function requireSuperAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role !== "super_admin") return null
  return user
}

async function requireAnyModuleAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role === "super_admin") return user

  const keys = await getUserPermissionKeys(user.id)
  const isAnyModuleAdmin = (["regulatory", "recruitment", "ims"] as const).some((m) => isModuleAdmin(keys, m))
  if (!isAnyModuleAdmin) return null
  return user
}

export async function GET() {
  const supabase = await createClient()
  // Any module admin can view users (to manage their module's access)
  const adminUser = await requireAnyModuleAdmin(supabase)
  if (!adminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, is_active, created_at")
    .order("full_name")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  // Only super admins can create users
  const adminUser = await requireSuperAdmin(supabase)
  if (!adminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await request.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const admin = createAdminClient()
  // No password is set here — the invitee sets their own via the link sent
  // below, same pattern as timesheets contractor/supervisor provisioning.
  // email_confirm: true marks the address confirmed at creation; the invite
  // link itself is the proof of ownership, so there's no separate
  // "confirm your email" step for the invitee to go through.
  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    user_metadata: { full_name: parsed.data.full_name },
    email_confirm: true,
  })

  if (authError || !authUser.user) {
    if (authError?.message.toLowerCase().includes("already registered") || authError?.message.toLowerCase().includes("already exists")) {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 })
    }
    return NextResponse.json({ error: authError?.message ?? "Failed to create user" }, { status: 500 })
  }

  if (parsed.data.role === "super_admin") {
    await admin
      .from("profiles")
      .update({ role: "super_admin" })
      .eq("id", authUser.user.id)
  }

  let emailSent = false
  if (!(await isEmailPaused())) {
    const { error: inviteError } = await admin.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${new URL(request.url).origin}/reset-password`,
    })
    emailSent = !inviteError
  }

  return NextResponse.json({ id: authUser.user.id, email_sent: emailSent }, { status: 201 })
}
