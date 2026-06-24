import { createClient } from "@/lib/supabase/server"
import { logConsultationEvent } from "@/lib/consultation-log"
import { NextResponse } from "next/server"
import { z } from "zod"
import { resolveAndPersistChemical } from "@/lib/chemicals/resolver"
import type { RegulatoryFramework } from "@/types/database"

const addSchema = z.object({
  cas: z.string().optional(),
  name: z.string().optional(),
  chemical_id: z.string().uuid().optional(),
  role: z.string().optional(),
  quantity: z.number().optional(),
  unit: z.string().optional(),
  notes: z.string().optional(),
  product_name: z.string().optional(),
}).refine((d) => d.cas || d.name || d.chemical_id, {
  message: "Provide cas, name, or chemical_id",
})

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ consultationId: string }> }
) {
  const { consultationId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data, error } = await supabase
    .schema("regulatory")
    .from("consultation_chemicals")
    .select(`
      id, chemical_id, role, quantity, unit, notes, product_name, alt_cas, added_at,
      chemicals(
        id, cas_number, common_name, iupac_name, molecular_formula,
        molecular_weight, needs_review,
        regulatory_listings(framework, status, list_name, last_checked)
      )
    `)
    .eq("consultation_id", consultationId)
    .order("added_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ consultationId: string }> }
) {
  const { consultationId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Verify consultation exists and user has access
  const { data: consultation, error: consultError } = await supabase
    .schema("regulatory")
    .from("consultations")
    .select("id, frameworks, company_id")
    .eq("id", consultationId)
    .single()

  if (consultError || !consultation) {
    return NextResponse.json({ error: "Consultation not found" }, { status: 404 })
  }

  const body = await request.json()
  const parsed = addSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  let chemicalId = parsed.data.chemical_id

  if (!chemicalId) {
    const frameworks = (consultation.frameworks ?? []) as RegulatoryFramework[]
    const chemical = await resolveAndPersistChemical(
      { cas: parsed.data.cas, name: parsed.data.name },
      frameworks
    )
    chemicalId = chemical.id
  }

  const { data, error } = await supabase
    .schema("regulatory")
    .from("consultation_chemicals")
    .upsert({
      consultation_id: consultationId,
      chemical_id: chemicalId,
      role: parsed.data.role,
      quantity: parsed.data.quantity,
      unit: parsed.data.unit,
      notes: parsed.data.notes,
      product_name: parsed.data.product_name ?? '',
    }, { onConflict: "consultation_id,chemical_id,product_name" })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Ensure the product exists as a stub in consultation_products
  const pName = parsed.data.product_name ?? ''
  if (pName) {
    await supabase
      .schema("regulatory")
      .from("consultation_products")
      .upsert(
        { consultation_id: consultationId, product_name: pName },
        { onConflict: "consultation_id,product_name", ignoreDuplicates: true }
      )
  }

  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ consultationId: string }> }
) {
  const { consultationId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id, chemical_id } = await request.json()
  if (!id || !chemical_id) {
    return NextResponse.json({ error: "Provide id and chemical_id" }, { status: 400 })
  }

  const { data: row } = await supabase
    .schema("regulatory")
    .from("consultation_chemicals")
    .select("product_name")
    .eq("consultation_id", consultationId)
    .eq("id", id)
    .single()

  if (!row) return NextResponse.json({ error: "Row not found" }, { status: 404 })

  const { data: conflict } = await supabase
    .schema("regulatory")
    .from("consultation_chemicals")
    .select("id")
    .eq("consultation_id", consultationId)
    .eq("chemical_id", chemical_id)
    .eq("product_name", row.product_name ?? '')
    .neq("id", id)
    .maybeSingle()

  if (conflict) {
    return NextResponse.json(
      { error: "This chemical is already in this product — remove the duplicate first." },
      { status: 409 }
    )
  }

  const { data, error } = await supabase
    .schema("regulatory")
    .from("consultation_chemicals")
    .update({ chemical_id, notes: null })
    .eq("consultation_id", consultationId)
    .eq("id", id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logConsultationEvent(consultationId, user.id, "chemical_resolved", {
    cc_id: id, chemical_id,
  })

  return NextResponse.json(data)
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
  const ccId = searchParams.get("id")

  if (!ccId) {
    return NextResponse.json({ error: "Provide id" }, { status: 400 })
  }

  const { error } = await supabase
    .schema("regulatory")
    .from("consultation_chemicals")
    .delete()
    .eq("consultation_id", consultationId)
    .eq("id", ccId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logConsultationEvent(consultationId, user.id, "chemical_removed", { cc_id: ccId })

  return new NextResponse(null, { status: 204 })
}
