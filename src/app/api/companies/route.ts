import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"
import { z } from "zod"

const createSchema = z.object({
  name:          z.string().min(1),
  abn:           z.string().optional(),
  country:       z.string().optional(),
  industry:      z.string().optional(),
  notes:         z.string().optional(),
  address_line1: z.string().optional(),
  address_line2: z.string().optional(),
  suburb:        z.string().optional(),
  state:         z.string().optional(),
  postcode:      z.string().optional(),
})

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // RLS handles scoping (module admins see all; members see assigned only)
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("is_active", true)
    .order("name")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Require regulatory OR crm module admin (or super admin)
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role !== "super_admin") {
    const { data: accesses } = await supabase
      .from("user_module_access")
      .select("module, access_level")
      .eq("user_id", user.id)
      .in("module", ["regulatory", "crm"])
    const isAdmin = (accesses ?? []).some(a => a.access_level === "admin")
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
  }

  const body = await request.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("companies")
    .insert(parsed.data)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Auto-create Head Office branch if address provided
  const hasAddress = parsed.data.address_line1 || parsed.data.suburb || parsed.data.postcode
  if (hasAddress) {
    await admin.from("company_branches").insert({
      company_id:    data.id,
      name:          "Head Office",
      address_line1: parsed.data.address_line1 ?? null,
      address_line2: parsed.data.address_line2 ?? null,
      suburb:        parsed.data.suburb         ?? null,
      state:         parsed.data.state          ?? null,
      postcode:      parsed.data.postcode        ?? null,
      country:       parsed.data.country         ?? "Australia",
      is_head_office: true,
    })
  }

  return NextResponse.json(data, { status: 201 })
}
