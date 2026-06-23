import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { z } from "zod"

const createSchema = z.object({
  common_name: z.string().min(1),
  cas_number: z.string().optional(),
  iupac_name: z.string().optional(),
  molecular_formula: z.string().optional(),
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

  const { data, error } = await supabase
    .schema("regulatory")
    .from("chemicals")
    .insert({ ...parsed.data, needs_review: true })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
