import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requirePermissionOrSuperAdmin } from "@/lib/auth-helpers"
import { z } from "zod"

const extendSchema = z.object({
  new_finish_date: z.string(),
  new_pay_rate: z.number().positive().optional().nullable(),
  new_charge_rate: z.number().positive().optional().nullable(),
  notes: z.string().optional(),
})

// POST /api/recruitment/contracts/[contractId]/extend
// Records a full historical extension row (not just an audit note) and
// updates the linked placement's finish_date/pay_rate/charge_rate so it
// stays the live source of truth (the contract-expiry-check cron reads
// placements.finish_date directly).
export async function POST(req: NextRequest, { params }: { params: Promise<{ contractId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await requirePermissionOrSuperAdmin(supabase, user.id, "recruitment.contracts.manage"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { contractId } = await params
  const body = await req.json()
  const parsed = extendSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recruitment = admin.schema("recruitment") as any

  const { data: contract } = await recruitment.from("contracts").select("id, placement_id").eq("id", contractId).single()
  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { data: placement } = await recruitment
    .from("placements")
    .select("finish_date, pay_rate, charge_rate")
    .eq("id", contract.placement_id)
    .single()
  if (!placement) return NextResponse.json({ error: "Placement not found" }, { status: 404 })

  const newPayRate = parsed.data.new_pay_rate ?? placement.pay_rate
  const newChargeRate = parsed.data.new_charge_rate ?? placement.charge_rate

  const { error: extensionError } = await recruitment.from("contract_extensions").insert({
    contract_id: contractId,
    previous_finish_date: placement.finish_date,
    new_finish_date: parsed.data.new_finish_date,
    previous_pay_rate: placement.pay_rate,
    new_pay_rate: newPayRate,
    previous_charge_rate: placement.charge_rate,
    new_charge_rate: newChargeRate,
    notes: parsed.data.notes || null,
    extended_by: user.id,
  })
  if (extensionError) return NextResponse.json({ error: extensionError.message }, { status: 500 })

  const { error: placementError } = await recruitment
    .from("placements")
    .update({ finish_date: parsed.data.new_finish_date, pay_rate: newPayRate, charge_rate: newChargeRate })
    .eq("id", contract.placement_id)
  if (placementError) return NextResponse.json({ error: placementError.message }, { status: 500 })

  // An extension on a lapsed/expired contract brings it back to active.
  await recruitment.from("contracts").update({ status: "active" }).eq("id", contractId)

  return NextResponse.json({ ok: true })
}
