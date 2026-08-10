import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { hasModuleAccessForUser, requirePermissionOrSuperAdmin } from "@/lib/auth-helpers"
import { z } from "zod"

const workHourEntry = z.object({
  day: z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
  start: z.string().nullable(),
  end: z.string().nullable(),
  working: z.boolean(),
})

const patchSchema = z.object({
  start_date: z.string().optional(),
  finish_date: z.string().optional().nullable(),
  contract_number: z.string().optional().nullable(),
  notice_period: z.string().optional().nullable(),
  award: z.string().optional().nullable(),
  award_level: z.string().optional().nullable(),
  payment_terms_days: z.number().int().optional().nullable(),
  overtime_applicable: z.boolean().optional(),
  po_required: z.boolean().optional(),
  position_title: z.string().optional().nullable(),
  safety_course_required: z.boolean().optional(),
  view_to_extend: z.boolean().optional(),
  permanent_conversion_status: z.enum(["not_notified", "notified", "converted", "declined", "not_applicable"]).optional(),
  next_award_review_date: z.string().optional().nullable(),
  reporting_contact_name: z.string().optional().nullable(),
  reporting_contact_email: z.string().optional().nullable(),
  work_attire_ppe: z.string().optional().nullable(),
  actual_finish_date: z.string().optional().nullable(),
  last_payment_date: z.string().optional().nullable(),
  working_hours: z.array(workHourEntry).optional().nullable(),
  lunch_break_minutes: z.number().int().optional().nullable(),
  start_time_first_day: z.string().optional().nullable(),
  recruitment_agreement_contact_id: z.string().uuid().optional().nullable(),
  invoicing_contact_id: z.string().uuid().optional().nullable(),
  timesheet_approver_contact_id: z.string().uuid().optional().nullable(),
  note: z.string().optional(),
  note_category: z.enum(["compliance", "client_instruction", "schedule", "rate_note", "other"]).optional(),
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
        job:jobs(id, title, reference_number, company_id, assigned_recruiter_id, location, employment_type),
        candidate:candidates(id, first_name, last_name, email, phone, current_title, current_employer, location_city, location_state, skills_tags, security_clearance_level, security_clearance_verified)
      )
    `)
    .eq("id", contractId)
    .single()
  if (error || !contract) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const [{ data: company }, { data: recruiterProfile }, { data: extensions }, { data: siblings }, { data: leavePeriods }, { data: notes }, { data: lookups }] = await Promise.all([
    contract.placement?.job?.company_id
      ? admin.from("companies").select("id, name").eq("id", contract.placement.job.company_id).single()
      : Promise.resolve({ data: null }),
    contract.placement?.job?.assigned_recruiter_id
      ? admin.from("profiles").select("full_name").eq("id", contract.placement.job.assigned_recruiter_id).maybeSingle()
      : Promise.resolve({ data: null }),
    recruitment
      .from("contract_extensions")
      .select("*")
      .eq("contract_id", contractId)
      .order("extended_at", { ascending: true }),
    contract.placement_id
      ? recruitment
          .from("contracts")
          .select("id, contract_number, status, is_current, start_date, finish_date, created_at")
          .eq("placement_id", contract.placement_id)
          .order("start_date", { ascending: true })
      : Promise.resolve({ data: [] }),
    recruitment.from("contract_leave_periods").select("*").eq("contract_id", contractId).order("start_date", { ascending: true }),
    recruitment.from("contract_notes").select("*").eq("contract_id", contractId).order("created_at", { ascending: true }),
    admin.from("lookup_values").select("category, value, label").in("category", ["award", "award_level"]),
  ])

  const contactIds = [contract.recruitment_agreement_contact_id, contract.invoicing_contact_id, contract.timesheet_approver_contact_id]
    .filter(Boolean) as string[]
  const { data: contactRows } = contactIds.length
    ? await admin.from("contacts").select("id, first_name, last_name, email").in("id", contactIds)
    : { data: [] }
  const contactMap = Object.fromEntries((contactRows ?? []).map((c: { id: string; first_name: string; last_name: string; email: string | null }) => [c.id, c]))

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
      ? {
          ...contract.placement,
          job: contract.placement.job
            ? { ...contract.placement.job, company_name: company?.name ?? null, recruiter_name: recruiterProfile?.full_name ?? null }
            : null,
        }
      : null,
    extensions: extensions ?? [],
    siblings: siblings ?? [],
    leave_periods: leavePeriods ?? [],
    notes: notes ?? [],
    lookups: lookups ?? [],
    recruitment_agreement_contact: contract.recruitment_agreement_contact_id ? contactMap[contract.recruitment_agreement_contact_id] ?? null : null,
    invoicing_contact: contract.invoicing_contact_id ? contactMap[contract.invoicing_contact_id] ?? null : null,
    timesheet_approver_contact: contract.timesheet_approver_contact_id ? contactMap[contract.timesheet_approver_contact_id] ?? null : null,
    timesheets_supervisor: timesheetsSupervisor,
  })
}

// PATCH /api/recruitment/contracts/[contractId]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ contractId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { contractId } = await params
  const body = await req.json()
  const { note, note_category, ...rest } = body
  const restKeys = Object.keys(rest)
  // A note-only patch (just a timeline update) is a low-risk collaborative
  // action available to any recruitment member. A dates-only patch needs
  // the narrower edit_dates permission (or the fuller manage permission,
  // which implies it) — everything else still needs manage. Same split
  // pattern the jobs route uses for its inline "add note" timeline action.
  const isNoteOnly = restKeys.length === 0
  const isDatesOnly = restKeys.length > 0 && restKeys.every((k) => k === "start_date" || k === "finish_date")

  let authorized: boolean
  if (isNoteOnly) {
    authorized = await requirePermissionOrSuperAdmin(supabase, user.id, "recruitment.access")
  } else if (isDatesOnly) {
    authorized =
      (await requirePermissionOrSuperAdmin(supabase, user.id, "recruitment.contracts.edit_dates")) ||
      (await requirePermissionOrSuperAdmin(supabase, user.id, "recruitment.contracts.manage"))
  } else {
    authorized = await requirePermissionOrSuperAdmin(supabase, user.id, "recruitment.contracts.manage")
  }
  if (!authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const parsed = patchSchema.safeParse({ ...rest, note, note_category })
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recruitment = admin.schema("recruitment") as any

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { note: _n, note_category: _nc, ...updateFields } = parsed.data
  const editingDates = "start_date" in updateFields || "finish_date" in updateFields

  // Fetch previous dates/placement_id before overwriting, so placements
  // (which the contract-expiry-check cron and list queries read directly)
  // can be kept in sync and the change can be logged to the timeline.
  let previous: { start_date: string | null; finish_date: string | null; placement_id: string } | null = null
  if (editingDates) {
    const { data: current } = await recruitment
      .from("contracts")
      .select("start_date, finish_date, placement_id")
      .eq("id", contractId)
      .single()
    previous = current ?? null
  }

  let data: Record<string, unknown> = { id: contractId }
  if (Object.keys(updateFields).length > 0) {
    const { data: updated, error } = await recruitment
      .from("contracts")
      .update(updateFields)
      .eq("id", contractId)
      .select("*")
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    data = updated
  }

  if (editingDates && previous) {
    const placementUpdate: Record<string, unknown> = {}
    if ("start_date" in updateFields) placementUpdate.start_date = updateFields.start_date
    if ("finish_date" in updateFields) placementUpdate.finish_date = updateFields.finish_date
    await recruitment.from("placements").update(placementUpdate).eq("id", previous.placement_id)

    const changes: string[] = []
    if ("start_date" in updateFields && updateFields.start_date !== previous.start_date) {
      changes.push(`Start date: ${previous.start_date ?? "—"} → ${updateFields.start_date ?? "—"}`)
    }
    if ("finish_date" in updateFields && updateFields.finish_date !== previous.finish_date) {
      changes.push(`Finish date: ${previous.finish_date ?? "—"} → ${updateFields.finish_date ?? "—"}`)
    }
    if (changes.length > 0) {
      await recruitment.from("contract_notes").insert({
        contract_id: contractId,
        category: "schedule",
        note: changes.join("; "),
        performed_by: user.id,
      })
    }
  }

  if (parsed.data.note) {
    const { error: noteError } = await recruitment.from("contract_notes").insert({
      contract_id: contractId,
      category: parsed.data.note_category ?? "other",
      note: parsed.data.note,
      performed_by: user.id,
    })
    if (noteError) return NextResponse.json({ error: noteError.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
