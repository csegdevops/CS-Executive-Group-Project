import { createClient } from "@/lib/supabase/server"
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
      id, role, quantity, unit, notes, added_at,
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
    }, { onConflict: "consultation_id,chemical_id" })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
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
  const chemicalId = searchParams.get("chemical_id")
  if (!chemicalId) {
    return NextResponse.json({ error: "Missing chemical_id" }, { status: 400 })
  }

  const { error } = await supabase
    .schema("regulatory")
    .from("consultation_chemicals")
    .delete()
    .eq("consultation_id", consultationId)
    .eq("chemical_id", chemicalId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
