import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { z } from "zod"
import type { LookupScope } from "@/types/database"

const createSchema = z.object({
  scope: z.enum(["global", "regulatory", "recruitment", "crm"]),
  category: z.string().min(1).max(60),
  value: z.string().min(1).max(100),
  label: z.string().min(1).max(200),
  sort_order: z.number().int().optional(),
})

// GET /api/lookup-values?scope=global,recruitment&category=company_industry&active=true
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = req.nextUrl
  const scopeParam = searchParams.get("scope")
  const category = searchParams.get("category")
  const activeOnly = searchParams.get("active") !== "false"

  let query = supabase
    .from("lookup_values")
    .select("id, scope, category, value, label, sort_order, is_active")
    .order("category")
    .order("sort_order")
    .order("label")

  if (scopeParam) {
    const scopes = scopeParam.split(",").map(s => s.trim()) as LookupScope[]
    query = query.in("scope", scopes)
  }
  if (category) query = query.eq("category", category)
  if (activeOnly) query = query.eq("is_active", true)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/lookup-values
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  // Permission check via RPC (mirrors can_manage_lookup DB function)
  const { data: canManage } = await supabase.rpc("can_manage_lookup", { p_scope: parsed.data.scope })
  if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("lookup_values")
    .insert({ ...parsed.data, created_by: user.id })
    .select("id, scope, category, value, label, sort_order, is_active")
    .single()

  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "A value with that key already exists in this category" }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}
