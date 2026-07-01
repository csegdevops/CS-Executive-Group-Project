import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { z } from "zod"

const upsertSchema = z.object({
  email: z.string().email(),
  phone: z.string().optional(),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  current_title: z.string().optional(),
  current_employer: z.string().optional(),
  location_city: z.string().optional(),
  location_state: z.string().optional(),
  location_country: z.string().default("AU"),
  skills_tags: z.array(z.string()).optional(),
  field_of_study: z.string().optional().nullable(),
  security_clearance_level: z.string().optional(),
  source_channel: z.enum(["seek_inbound", "company_website", "database_internal", "seek_talent", "linkedin"]).optional(),
})

// GET /api/recruitment/candidates?q=search&skills=&clearance=&page=1
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = req.nextUrl
  const q         = searchParams.get("q")
  const skills    = searchParams.get("skills")
  const clearance = searchParams.get("clearance")
  const active    = searchParams.get("active") !== "false"

  const admin = createAdminClient()

  // Full-text search via RPC
  if (q && q.trim().length > 1) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (admin.schema("recruitment") as any)
      .rpc("search_candidates", { query_text: q.trim(), lim: 60 })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
  }

  // List all (with optional filters)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (admin.schema("recruitment") as any)
    .from("candidates")
    .select(`
      id, first_name, last_name, email, phone,
      current_title, current_employer,
      location_city, location_state, location_country,
      skills_tags, security_clearance_level, security_clearance_verified,
      profile_completeness_pct, cv_parse_status, source_channel,
      is_active, created_at, updated_at
    `)
    .order("created_at", { ascending: false })
    .limit(200)

  if (active)    query = query.eq("is_active", true)
  if (clearance) query = query.eq("security_clearance_level", clearance)
  if (skills) {
    const skillList = skills.split(",").map(s => s.trim()).filter(Boolean)
    if (skillList.length) query = query.overlaps("skills_tags", skillList)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/recruitment/candidates — upsert via dedup RPC
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = upsertSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin.schema("recruitment") as any)
    .rpc("upsert_candidate", {
      p_email:                   parsed.data.email,
      p_phone:                   parsed.data.phone ?? null,
      p_first_name:              parsed.data.first_name,
      p_last_name:               parsed.data.last_name,
      p_current_title:           parsed.data.current_title ?? null,
      p_current_employer:        parsed.data.current_employer ?? null,
      p_location_city:           parsed.data.location_city ?? null,
      p_location_state:          parsed.data.location_state ?? null,
      p_location_country:        parsed.data.location_country,
      p_skills_tags:             parsed.data.skills_tags ?? null,
      p_field_of_study:          parsed.data.field_of_study ?? null,
      p_source_channel:          parsed.data.source_channel ?? null,
      p_added_by:                user.id,
    })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const result = data?.[0]
  return NextResponse.json(result, { status: result?.action === "inserted" ? 201 : 200 })
}
