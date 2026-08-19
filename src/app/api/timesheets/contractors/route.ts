import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requirePermissionOrSuperAdmin } from "@/lib/auth-helpers"
import { isEmailPaused, isExternalEmailPaused } from "@/lib/email/pause"
import { z } from "zod"

const createSchema = z.object({
  full_name:      z.string().min(1),
  email:          z.string().email(),
  company_id:     z.string().uuid(),
  branch_id:      z.string().uuid().optional().nullable(),
  candidate_id:   z.string().uuid().optional().nullable(),
  placement_id:   z.string().uuid().optional().nullable(),
  start_date:     z.string().min(1),
  finish_date:    z.string().optional().nullable(),
  pay_rate:       z.coerce.number().optional().nullable(),
  charge_rate:    z.coerce.number().optional().nullable(),
  currency:       z.string().default("AUD"),
  supervisor_id:  z.string().uuid().optional().nullable(),
})

// GET /api/timesheets/contractors
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const admin = createAdminClient()
  const ts = admin.schema("timesheets")

  const { data: contractors, error } = await ts
    .from("contractors")
    .select("id, full_name, email, company_id, branch_id, is_active, created_at")
    .order("created_at", { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const companyIds = [...new Set((contractors ?? []).map((c) => c.company_id))]
  const { data: companies } = companyIds.length
    ? await admin.from("companies").select("id, name").in("id", companyIds)
    : { data: [] }
  const companyMap = Object.fromEntries((companies ?? []).map((c) => [c.id, c.name]))

  const contractorIds = (contractors ?? []).map((c) => c.id)
  const { data: contracts } = contractorIds.length
    ? await ts.from("contracts").select("contractor_id, status, start_date, finish_date").in("contractor_id", contractorIds)
    : { data: [] }
  const contractMap = Object.fromEntries((contracts ?? []).map((c) => [c.contractor_id, c]))

  const { data: assignments } = contractorIds.length
    ? await ts.from("supervisor_assignments").select("contractor_id, supervisor_id").in("contractor_id", contractorIds).is("end_date", null)
    : { data: [] }
  const supervisorIds = [...new Set((assignments ?? []).map((a) => a.supervisor_id))]
  const { data: supervisors } = supervisorIds.length
    ? await ts.from("supervisors").select("id, full_name").in("id", supervisorIds)
    : { data: [] }
  const supervisorMap = Object.fromEntries((supervisors ?? []).map((s) => [s.id, s.full_name]))
  const activeSupervisorByContractor = Object.fromEntries(
    (assignments ?? []).map((a) => [a.contractor_id, supervisorMap[a.supervisor_id] ?? null])
  )

  const result = (contractors ?? []).map((c) => ({
    ...c,
    company_name: companyMap[c.company_id] ?? null,
    contract: contractMap[c.id] ?? null,
    active_supervisor_name: activeSupervisorByContractor[c.id] ?? null,
  }))

  return NextResponse.json(result)
}

// POST /api/timesheets/contractors — provisions a contractor login + contract,
// optionally assigns an initial supervisor. Invite mirrors the existing
// admin-triggered reset-password flow (src/app/api/users/[userId]/reset-password).
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await requirePermissionOrSuperAdmin(supabase, user.id, "timesheets.contractors.manage"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const input = parsed.data

  const admin = createAdminClient()
  const ts = admin.schema("timesheets")

  const { data: authUser, error: createUserError } = await admin.auth.admin.createUser({
    email: input.email,
    email_confirm: true,
    user_metadata: { full_name: input.full_name, user_type: "contractor" },
  })
  if (createUserError || !authUser.user) {
    return NextResponse.json({ error: createUserError?.message ?? "Failed to create login" }, { status: 500 })
  }

  const { data: contractor, error: contractorError } = await ts
    .from("contractors")
    .insert({
      user_id: authUser.user.id,
      candidate_id: input.candidate_id ?? null,
      placement_id: input.placement_id ?? null,
      company_id: input.company_id,
      branch_id: input.branch_id ?? null,
      full_name: input.full_name,
      email: input.email,
    })
    .select("*")
    .single()
  if (contractorError) {
    await admin.auth.admin.deleteUser(authUser.user.id)
    return NextResponse.json({ error: contractorError.message }, { status: 500 })
  }

  const { data: contract, error: contractError } = await ts
    .from("contracts")
    .insert({
      contractor_id: contractor.id,
      start_date: input.start_date,
      finish_date: input.finish_date ?? null,
      pay_rate: input.pay_rate ?? null,
      charge_rate: input.charge_rate ?? null,
      currency: input.currency,
    })
    .select("*")
    .single()
  if (contractError) return NextResponse.json({ error: contractError.message }, { status: 500 })

  await ts.from("contract_events").insert({
    contract_id: contract.id,
    event_type: "created",
    actor_user_id: user.id,
  })

  if (input.supervisor_id) {
    await ts.from("supervisor_assignments").insert({
      contractor_id: contractor.id,
      supervisor_id: input.supervisor_id,
      assigned_by: user.id,
    })
  }

  let emailSent = false
  if (!(await isEmailPaused()) && !(await isExternalEmailPaused())) {
    const timesheetsPortalOrigin = process.env.TIMESHEETS_PORTAL_URL ?? new URL(req.url).origin
    const { error: inviteError } = await admin.auth.resetPasswordForEmail(input.email, {
      redirectTo: `${timesheetsPortalOrigin}/reset-password`,
    })
    emailSent = !inviteError
  }

  return NextResponse.json({ contractor, contract, email_sent: emailSent }, { status: 201 })
}
