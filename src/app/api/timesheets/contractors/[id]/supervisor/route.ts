import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requirePermissionOrSuperAdmin } from "@/lib/auth-helpers"
import { z } from "zod"

const changeSchema = z.object({ supervisor_id: z.string().uuid() })

// POST /api/timesheets/contractors/[id]/supervisor — closes the currently
// active supervisor_assignments row (if any) and opens a new one. A
// contractor's supervisor can change over time (cover, reassignment) — this
// is a time-bound many-to-many, not a single FK overwrite.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await requirePermissionOrSuperAdmin(supabase, user.id, "timesheets.contractors.manage"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id: contractorId } = await params
  const body = await req.json()
  const parsed = changeSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const admin = createAdminClient()
  const ts = admin.schema("timesheets")

  const { data: current } = await ts
    .from("supervisor_assignments")
    .select("id, supervisor_id")
    .eq("contractor_id", contractorId)
    .is("end_date", null)
    .maybeSingle()

  if (current?.supervisor_id === parsed.data.supervisor_id) {
    return NextResponse.json({ error: "Contractor is already assigned to this supervisor" }, { status: 400 })
  }

  if (current) {
    await ts.from("supervisor_assignments").update({ end_date: new Date().toISOString().slice(0, 10) }).eq("id", current.id)
  }

  const { data: created, error } = await ts
    .from("supervisor_assignments")
    .insert({ contractor_id: contractorId, supervisor_id: parsed.data.supervisor_id, assigned_by: user.id })
    .select("*")
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: contract } = await ts.from("contracts").select("id").eq("contractor_id", contractorId).maybeSingle()
  if (contract) {
    await ts.from("contract_events").insert({
      contract_id: contract.id,
      event_type: "supervisor_changed",
      actor_user_id: user.id,
      details: { from: current?.supervisor_id ?? null, to: parsed.data.supervisor_id },
    })
  }

  return NextResponse.json(created, { status: 201 })
}
