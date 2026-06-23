import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

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

// GET /api/admin/consultations
// Returns all consultations with company name + assigned consultant IDs.
// Used by the AssignConsultationsDialog on the users page.
export async function GET() {
  const supabase = await createClient()
  const caller = await requireModuleAdmin(supabase)
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const admin = createAdminClient()

  // consultation_consultants is a new table not yet in generated DB types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reg = admin.schema("regulatory") as any

  const [consultationsRes, assignmentsRes] = await Promise.all([
    reg
      .from("consultations")
      .select("id, title, status, reference_number, company_id, companies(id, name)")
      .order("updated_at", { ascending: false }),
    reg
      .from("consultation_consultants")
      .select("consultation_id, consultant_id"),
  ])

  if (consultationsRes.error) {
    return NextResponse.json({ error: consultationsRes.error.message }, { status: 500 })
  }

  // Group consultant IDs by consultation
  const assignmentMap = new Map<string, string[]>()
  for (const a of (assignmentsRes.data ?? []) as { consultation_id: string; consultant_id: string }[]) {
    const list = assignmentMap.get(a.consultation_id) ?? []
    list.push(a.consultant_id)
    assignmentMap.set(a.consultation_id, list)
  }

  const consultations = (consultationsRes.data ?? []).map((c: { id: string; [k: string]: unknown }) => ({
    ...c,
    consultant_ids: assignmentMap.get(c.id) ?? [],
  }))

  return NextResponse.json(consultations)
}
