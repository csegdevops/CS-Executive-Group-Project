import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { hasModuleAccessForUser, requirePermissionOrSuperAdmin } from "@/lib/auth-helpers"
import { z } from "zod"

const patchSchema = z.object({
  contract_number: z.string().optional().nullable(),
  notice_period: z.string().optional().nullable(),
})

// GET /api/recruitment/contracts/[contractId]
export async function GET(req: NextRequest, { params }: { params: Promise<{ contractId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await hasModuleAccessForUser(supabase, user.id, "recruitment"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { contractId } = await params
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recruitment = admin.schema("recruitment") as any

  const { data: contract, error } = await recruitment
    .from("contracts")
    .select(`
      *,
      placement:placements(
        id, start_date, finish_date, pay_rate, charge_rate, currency, placement_type, status,
        job:jobs(id, title, reference_number, company_id),
        candidate:candidates(id, first_name, last_name, email, phone)
      )
    `)
    .eq("id", contractId)
    .single()
  if (error || !contract) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const [{ data: company }, { data: extensions }] = await Promise.all([
    contract.placement?.job?.company_id
      ? admin.from("companies").select("id, name").eq("id", contract.placement.job.company_id).single()
      : Promise.resolve({ data: null }),
    recruitment
      .from("contract_extensions")
      .select("*")
      .eq("contract_id", contractId)
      .order("extended_at", { ascending: true }),
  ])

  // Read-only lookup — never written to. Shows who's currently supervising
  // this contractor on the Timesheets portal, if this placement was ever
  // provisioned for it (via ProvisionTimesheetsDialog).
  let timesheetsSupervisor: { full_name: string | null; email: string } | null = null
  if (contract.placement?.id) {
    const { data: tsContractor } = await admin
      .schema("timesheets")
      .from("contractors")
      .select("id")
      .eq("placement_id", contract.placement.id)
      .maybeSingle()

    if (tsContractor) {
      const { data: assignment } = await admin
        .schema("timesheets")
        .from("supervisor_assignments")
        .select("supervisor_id")
        .eq("contractor_id", tsContractor.id)
        .is("end_date", null)
        .maybeSingle()

      if (assignment) {
        const { data: supervisor } = await admin
          .schema("timesheets")
          .from("supervisors")
          .select("full_name, email")
          .eq("id", assignment.supervisor_id)
          .single()
        timesheetsSupervisor = supervisor ?? null
      }
    }
  }

  return NextResponse.json({
    ...contract,
    placement: contract.placement
      ? { ...contract.placement, job: contract.placement.job ? { ...contract.placement.job, company_name: company?.name ?? null } : null }
      : null,
    extensions: extensions ?? [],
    timesheets_supervisor: timesheetsSupervisor,
  })
}

// PATCH /api/recruitment/contracts/[contractId]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ contractId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await requirePermissionOrSuperAdmin(supabase, user.id, "recruitment.contracts.manage"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { contractId } = await params
  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin.schema("recruitment") as any)
    .from("contracts")
    .update(parsed.data)
    .eq("id", contractId)
    .select("id, contract_number, notice_period, updated_at")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
