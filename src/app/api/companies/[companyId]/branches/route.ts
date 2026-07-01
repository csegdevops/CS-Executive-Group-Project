import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { z } from "zod"

const createSchema = z.object({
  name:          z.string().min(1),
  address_line1: z.string().optional().nullable(),
  address_line2: z.string().optional().nullable(),
  suburb:        z.string().optional().nullable(),
  state:         z.string().optional().nullable(),
  postcode:      z.string().optional().nullable(),
  country:       z.string().optional().nullable(),
  is_head_office: z.boolean().optional(),
})

export async function GET(_req: NextRequest, { params }: { params: Promise<{ companyId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { companyId } = await params
  const { data, error } = await createAdminClient()
    .from("company_branches")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("is_head_office", { ascending: false })
    .order("name")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ companyId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { companyId } = await params
  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const admin = createAdminClient()

  // Only one head office per company
  if (parsed.data.is_head_office) {
    await admin.from("company_branches")
      .update({ is_head_office: false })
      .eq("company_id", companyId)
  }

  const { data, error } = await admin
    .from("company_branches")
    .insert({ ...parsed.data, company_id: companyId })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
