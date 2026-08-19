import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requirePermissionOrSuperAdmin } from "@/lib/auth-helpers"
import { z } from "zod"

const patchSchema = z.object({
  hostname:        z.string().min(1).optional(),
  asset_tag:       z.string().optional().nullable(),
  device_type:     z.enum(["laptop", "desktop", "server", "printer", "network_device", "mobile", "other"]).optional(),
  make:            z.string().optional().nullable(),
  model:           z.string().optional().nullable(),
  serial_number:   z.string().optional().nullable(),
  service_tag:     z.string().optional().nullable(),
  assigned_to:     z.string().uuid().optional().nullable(),
  location:        z.enum(["Melbourne Office", "Sydney", "Brisbane", "Canberra"]).optional().nullable(),
  status:          z.enum(["in_use", "spare", "in_repair", "retired"]).optional(),
  purchase_date:   z.string().optional().nullable(),
  warranty_expiry: z.string().optional().nullable(),
  notes:           z.string().optional().nullable(),
})

// GET /api/ims/computers/[computerId]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ computerId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { computerId } = await params
  const ims = supabase.schema("ims")

  const [{ data: computer }, { data: logins }] = await Promise.all([
    ims.from("computers").select("*").eq("id", computerId).single(),
    ims.from("computer_logins").select("*").eq("computer_id", computerId).order("login_username"),
  ])

  if (!computer) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const profileIds = [...new Set([
    computer.assigned_to,
    ...(logins ?? []).map((l) => l.user_id),
  ].filter(Boolean))] as string[]
  const { data: profiles } = profileIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", profileIds)
    : { data: [] }
  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.full_name]))

  return NextResponse.json({
    ...computer,
    assigned_to_name: computer.assigned_to ? profileMap[computer.assigned_to] ?? null : null,
    logins: (logins ?? []).map((l) => ({ ...l, user_name: l.user_id ? profileMap[l.user_id] ?? null : null })),
  })
}

// PATCH /api/ims/computers/[computerId]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ computerId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await requirePermissionOrSuperAdmin(supabase, user.id, "ims.computers.manage"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { computerId } = await params
  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const admin = createAdminClient()

  // A computer that's in_use or in_repair needs a named owner — check the
  // state that would result from this patch, not just the fields it touches,
  // since e.g. a status-only patch can leave an existing computer un-owned.
  const { data: current } = await admin.schema("ims").from("computers").select("status, assigned_to").eq("id", computerId).single()
  if (current) {
    const effectiveStatus = parsed.data.status ?? current.status
    const effectiveAssignedTo = "assigned_to" in parsed.data ? parsed.data.assigned_to : current.assigned_to
    if (["in_use", "in_repair"].includes(effectiveStatus) && !effectiveAssignedTo) {
      return NextResponse.json(
        { error: "assigned_to is required while status is in_use or in_repair" },
        { status: 400 }
      )
    }
  }

  const { data, error } = await admin
    .schema("ims")
    .from("computers")
    .update(parsed.data)
    .eq("id", computerId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/ims/computers/[computerId]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ computerId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await requirePermissionOrSuperAdmin(supabase, user.id, "ims.computers.manage"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { computerId } = await params
  const admin = createAdminClient()
  const { error } = await admin.schema("ims").from("computers").delete().eq("id", computerId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
