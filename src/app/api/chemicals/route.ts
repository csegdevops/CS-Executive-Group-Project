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

  if (!q || q.length < 2) {
    const { data, error } = await reg
      .from("chemicals")
      .select("id, cas_number, common_name, iupac_name, molecular_formula, needs_review, resolved_at")
      .order("created_at", { ascending: false })
      .limit(50)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  // Search across common_name, cas_number, and aliases — two queries, then deduplicate
  const [directRes, aliasRes] = await Promise.all([
    reg
      .from("chemicals")
      .select("id, cas_number, common_name, iupac_name, molecular_formula, needs_review")
      .or(`common_name.ilike.%${q}%,cas_number.ilike.%${q}%,iupac_name.ilike.%${q}%`)
      .limit(30),
    reg
      .from("chemical_aliases")
      .select("chemical_id, chemicals(id, cas_number, common_name, iupac_name, molecular_formula, needs_review)")
      .ilike("alias", `%${q}%`)
      .limit(20),
  ])

  type ChemRow = { id: string; cas_number: string | null; common_name: string; iupac_name: string | null; molecular_formula: string | null; needs_review: boolean }

  const directResults = (directRes.data ?? []) as ChemRow[]
  const aliasResults = ((aliasRes.data ?? []) as { chemicals: ChemRow | null }[])
    .map((a) => a.chemicals)
    .filter((c): c is ChemRow => c !== null)

  const seen = new Set<string>()
  const merged = [...directResults, ...aliasResults].filter((c) => {
    if (seen.has(c.id)) return false
    seen.add(c.id)
    return true
  })

  return NextResponse.json(merged.slice(0, 40))
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
