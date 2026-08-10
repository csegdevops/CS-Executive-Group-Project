import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requirePermissionOrSuperAdmin } from "@/lib/auth-helpers"
import { z } from "zod"

const workHourEntry = z.object({
  day: z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
  start: z.string().nullable(),
  end: z.string().nullable(),
  working: z.boolean(),
})

const renewSchema = z.object({
  contract_number: z.string().optional().nullable(),
  notice_period: z.string().optional().nullable(),
  start_date: z.string(),
  finish_date: z.string().optional().nullable(),
  pay_rate: z.number().optional().nullable(),
  charge_rate: z.number().optional().nullable(),
  currency: z.string().optional(),
  factor_rate: z.number().optional().nullable(),
  pay_rate_excl_casual_loading: z.number().optional().nullable(),
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
  working_hours: z.array(workHourEntry).optional().nullable(),
  lunch_break_minutes: z.number().int().optional().nullable(),
  start_time_first_day: z.string().optional().nullable(),
  recruitment_agreement_contact_id: z.string().uuid().optional().nullable(),
  invoicing_contact_id: z.string().uuid().optional().nullable(),
  timesheet_approver_contact_id: z.string().uuid().optional().nullable(),
})

// POST /api/recruitment/contracts/[contractId]/renew
// A renewal is a NEW contract row under the same placement — unlike Extend
// (finish date only), rate/award/terms can all differ. Marks the current
// contract as superseded (is_current=false, status='expired') and inserts
// a new is_current=true row with the submitted terms, then mirrors the new
// contract's dates/rates onto placements (same sync principle Extend uses)
// so the contract-expiry-check cron and list queries keep working unchanged.
export async function POST(req: NextRequest, { params }: { params: Promise<{ contractId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await requirePermissionOrSuperAdmin(supabase, user.id, "recruitment.contracts.manage"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { contractId } = await params
  const body = await req.json()
  const parsed = renewSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recruitment = admin.schema("recruitment") as any

  const { data: oldContract } = await recruitment
    .from("contracts")
    .select("id, placement_id, is_current, recruitment_agreement_contact_id, invoicing_contact_id, timesheet_approver_contact_id")
    .eq("id", contractId)
    .single()
  if (!oldContract) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!oldContract.is_current) return NextResponse.json({ error: "Only the current contract can be renewed" }, { status: 400 })

  // Client contacts aren't part of the renewal form (they rarely change) —
  // carry them over from the previous contract unless explicitly overridden.
  const {
    recruitment_agreement_contact_id: newAgreementContact,
    invoicing_contact_id: newInvoicingContact,
    timesheet_approver_contact_id: newApproverContact,
    ...restFields
  } = parsed.data

  const { data: newContract, error: insertError } = await recruitment
    .from("contracts")
    .insert({
      placement_id: oldContract.placement_id,
      is_current: true,
      status: "active",
      recruitment_agreement_contact_id: newAgreementContact ?? oldContract.recruitment_agreement_contact_id,
      invoicing_contact_id: newInvoicingContact ?? oldContract.invoicing_contact_id,
      timesheet_approver_contact_id: newApproverContact ?? oldContract.timesheet_approver_contact_id,
      ...restFields,
    })
    .select("id")
    .single()
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  const { error: supersedeError } = await recruitment
    .from("contracts")
    .update({ is_current: false, status: "expired" })
    .eq("id", contractId)
  if (supersedeError) return NextResponse.json({ error: supersedeError.message }, { status: 500 })

  const { error: placementError } = await recruitment
    .from("placements")
    .update({
      finish_date: parsed.data.finish_date ?? null,
      pay_rate: parsed.data.pay_rate ?? null,
      charge_rate: parsed.data.charge_rate ?? null,
      currency: parsed.data.currency ?? "AUD",
    })
    .eq("id", oldContract.placement_id)
  if (placementError) return NextResponse.json({ error: placementError.message }, { status: 500 })

  return NextResponse.json({ ok: true, contract_id: newContract.id })
}
