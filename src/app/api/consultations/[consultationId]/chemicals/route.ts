import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
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

  let chemicalId = parsed.data.chemical_id ?? null
  let unresolvedName: string | null = null
  let unresolvedCas: string | null = null

  if (!chemicalId) {
    const frameworks = (consultation.frameworks ?? []) as RegulatoryFramework[]
    try {
      const chemical = await resolveAndPersistChemical(
        { cas: parsed.data.cas, name: parsed.data.name },
        frameworks
      )
      if (chemical) {
        chemicalId = chemical.id
      } else {
        unresolvedName = parsed.data.name ?? parsed.data.cas ?? null
        unresolvedCas  = parsed.data.cas ?? null
      }
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Failed to resolve chemical" },
        { status: 500 }
      )
    }
  }

  const admin = createAdminClient()
  const reg   = admin.schema("regulatory")

  const rowData = {
    consultation_id: consultationId,
    chemical_id: chemicalId,
    role: parsed.data.role,
    quantity: parsed.data.quantity,
    unit: parsed.data.unit,
    notes: unresolvedName ?? parsed.data.notes,
    alt_cas: unresolvedCas ?? null,
    product_name: parsed.data.product_name ?? '',
  }

  // When chemical_id is null, NULLs are distinct in the unique constraint — plain insert
  const { data, error } = chemicalId
    ? await reg
        .from("consultation_chemicals")
        .upsert(rowData, { onConflict: "consultation_id,chemical_id,product_name" })
        .select()
        .single()
    : await reg
        .from("consultation_chemicals")
        .insert(rowData)
        .select()
        .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Ensure the product exists as a stub in consultation_products
  const pName = parsed.data.product_name ?? ''
  if (pName) {
    await reg
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

  const body = await request.json()
  const { id } = body
  if (!id) return NextResponse.json({ error: "Provide id" }, { status: 400 })

  const admin = createAdminClient()
  const reg   = admin.schema("regulatory")

  // ── Resolve: link an unresolved row to a known chemical ──────────────────
  if ("chemical_id" in body) {
    const { chemical_id } = body
    if (!chemical_id) return NextResponse.json({ error: "Provide chemical_id" }, { status: 400 })

    const { data: row } = await reg
      .from("consultation_chemicals")
      .select("product_name")
      .eq("consultation_id", consultationId)
      .eq("id", id)
      .single()

    if (!row) return NextResponse.json({ error: "Row not found" }, { status: 404 })

    const { data: conflict } = await reg
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

    const { data, error } = await reg
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

  // ── Reassign: move row to a different product ─────────────────────────────
  if ("product_name" in body) {
    const newProduct: string = body.product_name ?? ''

    const { data: row } = await reg
      .from("consultation_chemicals")
      .select("chemical_id, product_name")
      .eq("consultation_id", consultationId)
      .eq("id", id)
      .single()

    if (!row) return NextResponse.json({ error: "Row not found" }, { status: 404 })

    // Conflict check only for resolved rows — null chemical_ids are always distinct
    if (row.chemical_id) {
      const { data: conflict } = await reg
        .from("consultation_chemicals")
        .select("id")
        .eq("consultation_id", consultationId)
        .eq("chemical_id", row.chemical_id)
        .eq("product_name", newProduct)
        .neq("id", id)
        .maybeSingle()

      if (conflict) {
        return NextResponse.json(
          { error: "This chemical is already in the target product." },
          { status: 409 }
        )
      }
    }

    // Clear concentration when moving between products — the value was formulation-specific.
    const { data, error } = await reg
      .from("consultation_chemicals")
      .update({ product_name: newProduct, quantity: null, unit: null })
      .eq("consultation_id", consultationId)
      .eq("id", id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await logConsultationEvent(consultationId, user.id, "chemical_reassigned", {
      cc_id: id,
      from:  row.product_name ?? '',
      to:    newProduct,
    })

    return NextResponse.json(data)
  }

  return NextResponse.json({ error: "Provide chemical_id or product_name" }, { status: 400 })
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
