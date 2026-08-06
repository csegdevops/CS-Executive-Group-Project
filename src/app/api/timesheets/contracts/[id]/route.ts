import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requirePermissionOrSuperAdmin } from "@/lib/auth-helpers"
import { z } from "zod"

// Extensions/renewals update the same contract row (per spec: "not necessarily
// a new record") rather than creating a new contract — the change is logged
// via contract_events instead.
const patchSchema = z.object({
  finish_date: z.string().optional().nullable(),
  pay_rate:    z.coerce.number().optional().nullable(),
  charge_rate: z.coerce.number().optional().nullable(),
  status:      z.enum(["active", "expired", "terminated"]).optional(),
})

// PATCH /api/timesheets/contracts/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await requirePermissionOrSuperAdmin(supabase, user.id, "timesheets.contracts.manage"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const admin = createAdminClient()
  const ts = admin.schema("timesheets")

  const { data: existing, error: fetchError } = await ts.from("contracts").select("*").eq("id", id).single()
  if (fetchError || !existing) return NextResponse.json({ error: "Contract not found" }, { status: 404 })

  const { data: updated, error } = await ts
    .from("contracts")
    .update(parsed.data)
    .eq("id", id)
    .select("*")
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const eventType = parsed.data.status === "terminated"
    ? "terminated"
    : parsed.data.finish_date && parsed.data.finish_date !== existing.finish_date
    ? "extended"
    : null

  if (eventType) {
    await ts.from("contract_events").insert({
      contract_id: id,
      event_type: eventType,
      actor_user_id: user.id,
      details: { previous_finish_date: existing.finish_date, new_finish_date: updated.finish_date },
    })
  }

  return NextResponse.json(updated)
}
