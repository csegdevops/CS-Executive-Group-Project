import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"
import { z } from "zod"

type Params = { params: Promise<{ userId: string }> }

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

// GET /api/users/[userId]/consultations
// Returns all consultations the user is assigned to (with company name)
export async function GET(_req: Request, { params }: Params) {
  const { userId } = await params
  const supabase = await createClient()
  const caller = await requireModuleAdmin(supabase)
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin.schema("regulatory") as any)
    .from("consultation_consultants")
    .select("consultation_id, consultations(id, title, status, reference_number, company_id, companies(id, name))")
    .eq("consultant_id", userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

const assignSchema = z.object({ consultation_id: z.string().uuid() })

// POST /api/users/[userId]/consultations
// Assigns the user as a consultant on the given consultation
export async function POST(request: Request, { params }: Params) {
  const { userId } = await params
  const supabase = await createClient()
  const caller = await requireModuleAdmin(supabase)
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await request.json()
  const parsed = assignSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin.schema("regulatory") as any)
    .from("consultation_consultants")
    .insert({
      consultation_id: parsed.data.consultation_id,
      consultant_id:   userId,
      assigned_by:     caller.id,
    })

  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "Already assigned" }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true }, { status: 201 })
}

// DELETE /api/users/[userId]/consultations?consultation_id=...
// Removes the user's assignment from a consultation
export async function DELETE(request: Request, { params }: Params) {
  const { userId } = await params
  const supabase = await createClient()
  const caller = await requireModuleAdmin(supabase)
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const consultationId = searchParams.get("consultation_id")
  if (!consultationId) {
    return NextResponse.json({ error: "consultation_id required" }, { status: 400 })
  }

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin.schema("regulatory") as any)
    .from("consultation_consultants")
    .delete()
    .eq("consultation_id", consultationId)
    .eq("consultant_id", userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
