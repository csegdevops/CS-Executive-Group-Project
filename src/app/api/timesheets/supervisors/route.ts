import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requirePermissionOrSuperAdmin } from "@/lib/auth-helpers"
import { isEmailPaused } from "@/lib/email/pause"
import { z } from "zod"

const createSchema = z.object({
  full_name:  z.string().min(1),
  email:      z.string().email(),
  company_id: z.string().uuid(),
  branch_id:  z.string().uuid().optional().nullable(),
  // Existing company contact to tag as a supervisor. Omit to create a new
  // contact record alongside the login (same boolean-flag tagging pattern as
  // is_primary / is_crm_contact / is_regulatory_contact / is_recruitment_contact).
  contact_id: z.string().uuid().optional().nullable(),
})

// GET /api/timesheets/supervisors
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const admin = createAdminClient()
  const ts = admin.schema("timesheets")

  const { data: supervisors, error } = await ts
    .from("supervisors")
    .select("id, full_name, email, company_id, branch_id, is_active, created_at")
    .order("created_at", { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const companyIds = [...new Set((supervisors ?? []).map((s) => s.company_id))]
  const { data: companies } = companyIds.length
    ? await admin.from("companies").select("id, name").in("id", companyIds)
    : { data: [] }
  const companyMap = Object.fromEntries((companies ?? []).map((c) => [c.id, c.name]))

  const supervisorIds = (supervisors ?? []).map((s) => s.id)
  const { data: activeAssignments } = supervisorIds.length
    ? await ts.from("supervisor_assignments").select("supervisor_id").in("supervisor_id", supervisorIds).is("end_date", null)
    : { data: [] }
  const activeCountBySupervisor: Record<string, number> = {}
  for (const a of activeAssignments ?? []) {
    activeCountBySupervisor[a.supervisor_id] = (activeCountBySupervisor[a.supervisor_id] ?? 0) + 1
  }

  const result = (supervisors ?? []).map((s) => ({
    ...s,
    company_name: companyMap[s.company_id] ?? null,
    active_contractor_count: activeCountBySupervisor[s.id] ?? 0,
  }))

  return NextResponse.json(result)
}

// POST /api/timesheets/supervisors — provisions a supervisor login, tagging
// (or creating) the corresponding company contact record.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await requirePermissionOrSuperAdmin(supabase, user.id, "timesheets.supervisors.manage"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const input = parsed.data

  const admin = createAdminClient()
  const ts = admin.schema("timesheets")

  let contactId = input.contact_id ?? null
  if (contactId) {
    const { error: tagError } = await admin.from("contacts").update({ is_timesheets_supervisor: true }).eq("id", contactId)
    if (tagError) return NextResponse.json({ error: tagError.message }, { status: 500 })
  } else {
    const [firstName, ...rest] = input.full_name.trim().split(" ")
    const { data: contact, error: contactError } = await admin
      .from("contacts")
      .insert({
        company_id: input.company_id,
        branch_id: input.branch_id ?? null,
        first_name: firstName,
        last_name: rest.join(" ") || firstName,
        email: input.email,
        is_timesheets_supervisor: true,
        added_by: user.id,
      })
      .select("id")
      .single()
    if (contactError) return NextResponse.json({ error: contactError.message }, { status: 500 })
    contactId = contact.id
  }

  const { data: authUser, error: createUserError } = await admin.auth.admin.createUser({
    email: input.email,
    email_confirm: true,
    user_metadata: { full_name: input.full_name, user_type: "supervisor" },
  })
  if (createUserError || !authUser.user) {
    return NextResponse.json({ error: createUserError?.message ?? "Failed to create login" }, { status: 500 })
  }

  const { data: supervisor, error: supervisorError } = await ts
    .from("supervisors")
    .insert({
      user_id: authUser.user.id,
      contact_id: contactId,
      company_id: input.company_id,
      branch_id: input.branch_id ?? null,
      full_name: input.full_name,
      email: input.email,
    })
    .select("*")
    .single()
  if (supervisorError) {
    await admin.auth.admin.deleteUser(authUser.user.id)
    return NextResponse.json({ error: supervisorError.message }, { status: 500 })
  }

  let emailSent = false
  if (!(await isEmailPaused())) {
    const timesheetsPortalOrigin = process.env.TIMESHEETS_PORTAL_URL ?? new URL(req.url).origin
    const { error: inviteError } = await admin.auth.resetPasswordForEmail(input.email, {
      redirectTo: `${timesheetsPortalOrigin}/reset-password`,
    })
    emailSent = !inviteError
  }

  return NextResponse.json({ ...supervisor, email_sent: emailSent }, { status: 201 })
}
