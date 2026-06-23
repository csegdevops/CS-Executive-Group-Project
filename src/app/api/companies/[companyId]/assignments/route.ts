import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"
import { z } from "zod"

const assignSchema = z.object({
  consultant_id: z.string().uuid(),
  assignment_type: z.enum(["primary", "temporary"]),
  end_date: z.string().optional().nullable(),
  notes: z.string().optional(),
})

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
    .single()
  if (access?.access_level !== "admin") return null
  return user
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data, error } = await supabase
    .schema("regulatory")
    .from("consultant_company_assignments")
    .select("*, profiles(id, full_name, role)")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params
  const supabase = await createClient()
  const adminUser = await requireModuleAdmin(supabase)
  if (!adminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await request.json()
  const parsed = assignSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .schema("regulatory")
    .from("consultant_company_assignments")
    .upsert({
      ...parsed.data,
      company_id: companyId,
    }, { onConflict: "consultant_id,company_id,assignment_type" })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params
  const supabase = await createClient()
  const adminUser = await requireModuleAdmin(supabase)
  if (!adminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const assignmentId = searchParams.get("id")
  if (!assignmentId) {
    return NextResponse.json({ error: "Missing assignment id" }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .schema("regulatory")
    .from("consultant_company_assignments")
    .delete()
    .eq("id", assignmentId)
    .eq("company_id", companyId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
