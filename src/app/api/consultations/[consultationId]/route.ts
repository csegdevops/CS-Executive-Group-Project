import { createClient } from "@/lib/supabase/server"
import { logConsultationEvent } from "@/lib/consultation-log"
import { NextResponse } from "next/server"
import { z } from "zod"

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  status: z.enum(["draft", "in_progress", "under_review", "completed", "archived"]).optional(),
  frameworks: z.array(z.enum(["aicis", "reach", "tsca"])).optional(),
  reference_number: z.string().optional().nullable(),
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

  // Fetch current values for field-level audit trail
  const { data: current } = await supabase
    .schema("regulatory")
    .from("consultations")
    .select("title, description, status, frameworks, reference_number, due_date, completed_at")
    .eq("id", consultationId)
    .single()

  const { data, error } = await supabase
    .schema("regulatory")
    .from("consultations")
    .update(updates)
    .eq("id", consultationId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Log each changed field
  if (current) {
    const auditableFields = ["title", "description", "status", "frameworks", "reference_number", "due_date"] as const
    for (const field of auditableFields) {
      const oldVal = (current as Record<string, unknown>)[field]
      const newVal = (updates as Record<string, unknown>)[field]
      if (newVal === undefined) continue
      const oldStr = JSON.stringify(oldVal)
      const newStr = JSON.stringify(newVal)
      if (oldStr !== newStr) {
        await logConsultationEvent(consultationId, user.id, "details_updated", {
          field, old: oldVal, new: newVal,
        })
      }
    }
  }

  return NextResponse.json(data)
}
