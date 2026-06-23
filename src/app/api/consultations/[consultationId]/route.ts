import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { z } from "zod"

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(["draft", "in_progress", "under_review", "completed", "archived"]).optional(),
  frameworks: z.array(z.enum(["aicis", "reach", "tsca"])).optional(),
  due_date: z.string().optional().nullable(),
  completed_at: z.string().optional().nullable(),
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
    .from("consultations")
    .select(`
      *,
      consultation_chemicals(
        id, role, quantity, unit, notes, added_at,
        chemicals(id, cas_number, common_name, iupac_name, molecular_formula, needs_review,
          regulatory_listings(id, framework, status, list_name, list_url, last_checked)
        )
      )
    `)
    .eq("id", consultationId)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Fetch company separately (cross-schema join)
  const { data: company } = await supabase
    .from("companies")
    .select("id, name, country")
    .eq("id", (data as { company_id: string }).company_id)
    .single()

  return NextResponse.json({ ...data, companies: company })
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
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const updates = { ...parsed.data } as {
    title?: string
    description?: string | null
    status?: "draft" | "in_progress" | "under_review" | "completed" | "archived"
    frameworks?: ("aicis" | "reach" | "tsca")[]
    reference_number?: string | null
    due_date?: string | null
    completed_at?: string | null
  }
  if (updates.status === "completed" && !updates.completed_at) {
    updates.completed_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .schema("regulatory")
    .from("consultations")
    .update(updates)
    .eq("id", consultationId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
