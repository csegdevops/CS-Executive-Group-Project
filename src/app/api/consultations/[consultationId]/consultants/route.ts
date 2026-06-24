import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { logConsultationEvent } from "@/lib/consultation-log"
import { NextResponse } from "next/server"
import { z } from "zod"

type Params = { params: Promise<{ consultationId: string }> }

async function requireModuleAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role === "super_admin") return user
  const { data: access } = await supabase
    .from("user_module_access")
    .select("access_level")
    .eq("user_id", user.id)
    .eq("module", "regulatory")
    .eq("access_level", "admin")
    .maybeSingle()
  if (!access) return null
  return user
}

// GET /api/consultations/[consultationId]/consultants
// Returns all regulatory users with is_assigned flag for this consultation
export async function GET(_req: Request, { params }: Params) {
  const { consultationId } = await params
  const supabase = await createClient()
  const caller = await requireModuleAdmin(supabase)
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const admin = createAdminClient()

  const [profilesRes, accessRes, assignedRes] = await Promise.all([
    admin.from("profiles").select("id, full_name, is_active").eq("is_active", true).order("full_name"),
    admin.from("user_module_access").select("user_id").eq("module", "regulatory"),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin.schema("regulatory") as any)
      .from("consultation_consultants")
      .select("consultant_id")
      .eq("consultation_id", consultationId),
  ])

  const regulatoryUserIds = new Set(
    (accessRes.data ?? []).map((r: { user_id: string }) => r.user_id)
  )
  const assignedIds = new Set(
    (assignedRes.data ?? []).map((r: { consultant_id: string }) => r.consultant_id)
  )

  const users = (profilesRes.data ?? [])
    .filter((p) => regulatoryUserIds.has(p.id))
    .map((p) => ({
      id: p.id,
      full_name: p.full_name,
      is_assigned: assignedIds.has(p.id),
    }))

  return NextResponse.json(users)
}

const assignSchema = z.object({ user_id: z.string().uuid() })

// POST /api/consultations/[consultationId]/consultants
// Assigns a user as consultant on this consultation
export async function POST(request: Request, { params }: Params) {
  const { consultationId } = await params
  const supabase = await createClient()
  const caller = await requireModuleAdmin(supabase)
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await request.json()
  const parsed = assignSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin.schema("regulatory") as any)
    .from("consultation_consultants")
    .insert({ consultation_id: consultationId, consultant_id: parsed.data.user_id, assigned_by: caller.id })

  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "Already assigned" }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logConsultationEvent(consultationId, caller.id, "consultant_assigned", { user_id: parsed.data.user_id })
  return NextResponse.json({ ok: true }, { status: 201 })
}

// DELETE /api/consultations/[consultationId]/consultants?user_id=xxx
export async function DELETE(request: Request, { params }: Params) {
  const { consultationId } = await params
  const supabase = await createClient()
  const caller = await requireModuleAdmin(supabase)
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const userId = searchParams.get("user_id")
  if (!userId) return NextResponse.json({ error: "user_id required" }, { status: 400 })

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin.schema("regulatory") as any)
    .from("consultation_consultants")
    .delete()
    .eq("consultation_id", consultationId)
    .eq("consultant_id", userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logConsultationEvent(consultationId, caller.id, "consultant_removed", { user_id: userId })
  return NextResponse.json({ ok: true })
}
