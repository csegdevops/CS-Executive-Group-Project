import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requirePermissionOrSuperAdmin } from "@/lib/auth-helpers"
import { z } from "zod"
import { sendOpportunityStageChangedEmail } from "@/lib/email/notifications"

const patchSchema = z.object({
  title:               z.string().min(1).optional(),
  stage:               z.enum(["lead", "qualified", "proposal", "negotiation", "won", "lost"]).optional(),
  value:               z.number().positive().optional().nullable(),
  module:              z.enum(["regulatory", "recruitment", "both"]).optional().nullable(),
  assigned_to:         z.string().uuid().optional().nullable(),
  contact_id:          z.string().uuid().optional().nullable(),
  expected_close_date: z.string().optional().nullable(),
  closed_at:           z.string().optional().nullable(),
  close_reason:        z.string().optional().nullable(),
  notes:               z.string().optional().nullable(),
})

// GET /api/recruitment/opportunities/[oppId]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ oppId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { oppId } = await params
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (createAdminClient().schema("recruitment") as any)
    .from("opportunities")
    .select("*")
    .eq("id", oppId)
    .single()

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(data)
}

// PATCH /api/recruitment/opportunities/[oppId]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ oppId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await requirePermissionOrSuperAdmin(supabase, user.id, "recruitment.opportunities.edit"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { oppId } = await params
  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const update: Record<string, unknown> = { ...parsed.data }

  // Auto-set closed_at when moving to won/lost
  if ((parsed.data.stage === "won" || parsed.data.stage === "lost") && !parsed.data.closed_at) {
    update.closed_at = new Date().toISOString()
  }

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recruitment = admin.schema("recruitment") as any

  const { data: current } = await recruitment
    .from("opportunities")
    .select("stage, title, assigned_to")
    .eq("id", oppId)
    .single()

  const { data, error } = await recruitment
    .from("opportunities")
    .update(update)
    .eq("id", oppId)
    .select("*")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (current && parsed.data.stage && parsed.data.stage !== current.stage && current.assigned_to) {
    sendOpportunityStageChangedEmail({
      opportunityId: oppId,
      opportunityTitle: current.title,
      oldStage: current.stage,
      newStage: parsed.data.stage,
      recipientUserId: current.assigned_to,
    }).catch((err) => console.error("[email] opportunity stage-changed notification failed", err))
  }

  return NextResponse.json(data)
}
