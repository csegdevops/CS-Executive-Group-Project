import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { logConsultationEvent } from "@/lib/consultation-log"
import { NextResponse } from "next/server"
import { z } from "zod"

const createSchema = z.object({
  common_name: z.string().min(1),
  cas_number: z.string().optional().nullable(),
  iupac_name: z.string().optional().nullable(),
  molecular_formula: z.string().optional().nullable(),
  // Chemskill-specific fields
  consultation_chemical_id: z.string().uuid().optional(),
  consultation_id: z.string().uuid().optional(),
  regulatory: z.array(z.object({
    framework: z.enum(["aicis", "reach", "tsca"]),
    status: z.enum(["not_listed", "unknown", "restricted", "exempt", "pending"]),
    notes: z.string().optional().nullable(),
  })).optional(),
})

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const q = searchParams.get("q")?.trim()

  const reg = supabase.schema("regulatory")

  const words = q ? q.split(/\s+/).filter((w) => w.length >= 2) : []

  if (!q || words.length === 0) {
    const { data, error } = await reg
      .from("chemicals")
      .select("id, cas_number, common_name, iupac_name, molecular_formula, needs_review, resolved_at")
      .order("created_at", { ascending: false })
      .limit(50)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  // RPC handles multi-keyword AND search + alias matching in one unambiguous SQL query.
  // Each word must appear somewhere in common_name, cas_number, iupac_name, or any alias.
  const { data, error: rpcError } = await supabase.rpc("search_chemicals", { query_words: words })
  if (rpcError) return NextResponse.json({ error: rpcError.message }, { status: 500 })

  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const admin = createAdminClient()
  const reg   = admin.schema("regulatory")

  const { consultation_chemical_id, consultation_id, regulatory, ...chemFields } = parsed.data

  const { data: chemical, error } = await reg
    .from("chemicals")
    .insert({ ...chemFields, needs_review: true, source: "chemskill" })
    .select()
    .single()

  if (error || !chemical) return NextResponse.json({ error: error?.message ?? "Insert failed" }, { status: 500 })

  // Insert regulatory listings
  if (regulatory && regulatory.length > 0) {
    const listings = regulatory.map((r) => ({
      chemical_id:  chemical.id,
      framework:    r.framework,
      status:       r.status,
      notes:        r.notes ?? null,
      list_name:    "Chemskill",
      source:       "chemskill",
      last_checked: new Date().toISOString(),
    }))
    await reg.from("regulatory_listings").upsert(listings, {
      onConflict: "chemical_id,framework", ignoreDuplicates: false,
    })
  }

  // Link back to consultation chemical row
  if (consultation_chemical_id) {
    await reg
      .from("consultation_chemicals")
      .update({ chemical_id: chemical.id, notes: null })
      .eq("id", consultation_chemical_id)

    if (consultation_id) {
      await logConsultationEvent(consultation_id, user.id, "chemical_pushed_to_db", {
        name: chemical.common_name, chemical_id: chemical.id,
      })
    }
  }

  return NextResponse.json(chemical, { status: 201 })
}
