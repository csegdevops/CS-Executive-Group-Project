import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { z } from "zod"

const upsertSchema = z.object({
  product_name:    z.string().min(1),
  units_per_year:  z.number().positive().nullable().optional(),
  unit_size_grams: z.number().positive().nullable().optional(),
})

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ consultationId: string }> }
) {
  const { consultationId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const reg = supabase.schema("regulatory")

  // Get products for this consultation
  const { data: products, error: prodError } = await reg
    .from("consultation_products")
    .select("id, product_name, units_per_year, unit_size_grams")
    .eq("consultation_id", consultationId)
    .order("product_name")

  if (prodError) return NextResponse.json({ error: prodError.message }, { status: 500 })

  // Get the company_id so we can compute cumulative volumes across all their consultations
  const { data: consult } = await reg
    .from("consultations")
    .select("company_id")
    .eq("id", consultationId)
    .single()

  if (!consult?.company_id) {
    return NextResponse.json({ products: products ?? [], cumulative: {} })
  }

  // All consultations for this company
  const { data: allConsults } = await reg
    .from("consultations")
    .select("id")
    .eq("company_id", consult.company_id)

  const allConsultIds = (allConsults ?? []).map((c) => c.id)

  if (allConsultIds.length === 0) {
    return NextResponse.json({ products: products ?? [], cumulative: {} })
  }

  // All chemicals with concentrations across all company consultations
  const { data: allChemicals } = await reg
    .from("consultation_chemicals")
    .select("chemical_id, quantity, consultation_id, product_name")
    .in("consultation_id", allConsultIds)
    .not("quantity", "is", null)

  // All product volume inputs across all company consultations
  const { data: allProducts } = await reg
    .from("consultation_products")
    .select("consultation_id, product_name, units_per_year, unit_size_grams")
    .in("consultation_id", allConsultIds)
    .not("units_per_year", "is", null)
    .not("unit_size_grams", "is", null)

  // Compute cumulative annual volume per chemical (kg/year)
  const productKey = (cid: string, name: string) => `${cid}::${name}`
  const productMap = new Map(
    (allProducts ?? []).map((p) => [productKey(p.consultation_id, p.product_name), p])
  )

  const cumulativeKg: Record<string, number> = {}
  for (const chem of allChemicals ?? []) {
    if (!chem.chemical_id || !chem.product_name || !chem.quantity) continue
    const prod = productMap.get(productKey(chem.consultation_id, chem.product_name))
    if (!prod?.units_per_year || !prod?.unit_size_grams) continue
    const vol = (prod.units_per_year * prod.unit_size_grams * chem.quantity / 100) / 1000
    cumulativeKg[chem.chemical_id] = (cumulativeKg[chem.chemical_id] ?? 0) + vol
  }

  return NextResponse.json({ products: products ?? [], cumulative: cumulativeKg })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ consultationId: string }> }
) {
  const { consultationId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const parsed = upsertSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { data, error } = await supabase
    .schema("regulatory")
    .from("consultation_products")
    .upsert(
      { consultation_id: consultationId, ...parsed.data },
      { onConflict: "consultation_id,product_name" }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 200 })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ consultationId: string }> }
) {
  const { consultationId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const productName = searchParams.get("product_name")
  if (!productName) {
    return NextResponse.json({ error: "Missing product_name" }, { status: 400 })
  }

  const { error } = await supabase
    .schema("regulatory")
    .from("consultation_products")
    .delete()
    .eq("consultation_id", consultationId)
    .eq("product_name", productName)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
