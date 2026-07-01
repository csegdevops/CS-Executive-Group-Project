import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { z } from "zod"

const updateSchema = z.object({
  label: z.string().min(1).max(200).optional(),
  sort_order: z.number().int().optional(),
  is_active: z.boolean().optional(),
}).refine(d => Object.keys(d).length > 0, { message: "No fields to update" })

// PATCH /api/lookup-values/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  // Fetch existing to get scope for permission check
  const { data: existing } = await supabase
    .from("lookup_values")
    .select("scope")
    .eq("id", id)
    .single()
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { data: canManage } = await supabase.rpc("can_manage_lookup", { p_scope: existing.scope })
  if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("lookup_values")
    .update(parsed.data)
    .eq("id", id)
    .select("id, scope, category, value, label, sort_order, is_active")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/lookup-values/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const { data: existing } = await supabase
    .from("lookup_values")
    .select("scope")
    .eq("id", id)
    .single()
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { data: canManage } = await supabase.rpc("can_manage_lookup", { p_scope: existing.scope })
  if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const admin = createAdminClient()
  const { error } = await admin.from("lookup_values").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
