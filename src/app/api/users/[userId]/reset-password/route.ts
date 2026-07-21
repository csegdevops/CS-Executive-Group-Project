import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data: authUser, error: lookupError } = await admin.auth.admin.getUserById(userId)
  if (lookupError || !authUser.user?.email) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  const { error } = await admin.auth.resetPasswordForEmail(authUser.user.email, {
    redirectTo: `${new URL(request.url).origin}/reset-password`,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, email: authUser.user.email })
}
