import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { resolveAndPersistChemical } from "@/lib/chemicals/resolver"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ chemicalId: string }> }
) {
  const { chemicalId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data, error } = await supabase
    .schema("regulatory")
    .from("regulatory_listings")
    .select("*")
    .eq("chemical_id", chemicalId)
    .order("framework")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ chemicalId: string }> }
) {
  const { chemicalId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: chemical } = await supabase
    .schema("regulatory")
    .from("chemicals")
    .select("cas_number, common_name")
    .eq("id", chemicalId)
    .single()

  if (!chemical) return NextResponse.json({ error: "Chemical not found" }, { status: 404 })

  await resolveAndPersistChemical(
    { cas: chemical.cas_number ?? undefined, name: chemical.common_name },
    ["aicis", "reach", "tsca"]
  )

  return NextResponse.json({ ok: true })
}
