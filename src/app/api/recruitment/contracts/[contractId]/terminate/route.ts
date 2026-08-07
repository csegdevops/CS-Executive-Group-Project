import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requirePermissionOrSuperAdmin } from "@/lib/auth-helpers"
import { z } from "zod"

const terminateSchema = z.object({
  reason: z.string().optional(),
})

// POST /api/recruitment/contracts/[contractId]/terminate
export async function POST(req: NextRequest, { params }: { params: Promise<{ contractId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await requirePermissionOrSuperAdmin(supabase, user.id, "recruitment.contracts.manage"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { contractId } = await params
  const body = await req.json().catch(() => ({}))
  const parsed = terminateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recruitment = admin.schema("recruitment") as any

  const { data: contract } = await recruitment.from("contracts").select("id, placement_id").eq("id", contractId).single()
  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { error } = await recruitment
    .from("contracts")
    .update({
      status: "terminated",
      termination_reason: parsed.data.reason || null,
      terminated_by: user.id,
      terminated_at: new Date().toISOString(),
    })
    .eq("id", contractId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Stops the contract-expiry-check cron from emailing about it further —
  // it only queries placements with status IN ('confirmed', 'started').
  await recruitment.from("placements").update({ status: "cancelled" }).eq("id", contract.placement_id)

  return NextResponse.json({ ok: true })
}
