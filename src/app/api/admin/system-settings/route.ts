import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requirePermissionOrSuperAdmin, hasPermission, getUserPermissionKeys } from "@/lib/auth-helpers"
import { NextResponse } from "next/server"
import { z } from "zod"
import type { Database } from "@/types/database"

type SystemSettingsUpdate = Database["public"]["Tables"]["system_settings"]["Update"]

// GET /api/admin/system-settings
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data, error } = await supabase
    .from("system_settings")
    .select("emails_paused, emails_paused_at, ai_paused, ai_paused_at, external_emails_paused, external_emails_paused_at, maintenance_mode, maintenance_mode_at")
    .eq("id", true)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

const patchSchema = z.object({
  emails_paused: z.boolean().optional(),
  ai_paused: z.boolean().optional(),
  external_emails_paused: z.boolean().optional(),
  maintenance_mode: z.boolean().optional(),
}).refine(
  (v) => v.emails_paused !== undefined || v.ai_paused !== undefined || v.external_emails_paused !== undefined || v.maintenance_mode !== undefined,
  { message: "At least one of emails_paused, ai_paused, external_emails_paused, maintenance_mode must be provided" }
)

// PATCH /api/admin/system-settings — the "Pause all emails" / "Pause all AI
// features" / "Pause external emails" / "Maintenance mode" toggles. Any
// field may be sent independently.
//
// emails_paused and external_emails_paused always require platform_settings.manage.
// ai_paused can be changed by platform_settings.manage OR the narrower
// ai.pause.manage key, so AI oversight can be granted without full
// platform-settings access.
// maintenance_mode is deliberately stricter than the rest: super_admin role
// only, not delegable via platform_settings.manage — it locks the whole
// portal (staff and timesheets contractors/supervisors alike) to super
// admins, so granting it away would let a module admin lock everyone else out.
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = user.id

  const body = await request.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { emails_paused, ai_paused, external_emails_paused, maintenance_mode } = parsed.data

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).single()
  const isSuperAdmin = profile?.role === "super_admin"

  if (maintenance_mode !== undefined && !isSuperAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const hasPlatformSettings = isSuperAdmin || await requirePermissionOrSuperAdmin(supabase, userId, "platform_settings.manage")
  if ((emails_paused !== undefined || external_emails_paused !== undefined) && !hasPlatformSettings) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  if (ai_paused !== undefined && !hasPlatformSettings) {
    const keys = await getUserPermissionKeys(userId)
    if (!hasPermission(keys, "ai.pause.manage")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
  }
  const update: SystemSettingsUpdate = {}
  if (emails_paused !== undefined) {
    update.emails_paused = emails_paused
    update.emails_paused_by = emails_paused ? userId : null
    update.emails_paused_at = emails_paused ? new Date().toISOString() : null
  }
  if (ai_paused !== undefined) {
    update.ai_paused = ai_paused
    update.ai_paused_by = ai_paused ? userId : null
    update.ai_paused_at = ai_paused ? new Date().toISOString() : null
  }
  if (external_emails_paused !== undefined) {
    update.external_emails_paused = external_emails_paused
    update.external_emails_paused_by = external_emails_paused ? userId : null
    update.external_emails_paused_at = external_emails_paused ? new Date().toISOString() : null
  }
  if (maintenance_mode !== undefined) {
    update.maintenance_mode = maintenance_mode
    update.maintenance_mode_by = maintenance_mode ? userId : null
    update.maintenance_mode_at = maintenance_mode ? new Date().toISOString() : null
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("system_settings")
    .update(update)
    .eq("id", true)
    .select("emails_paused, emails_paused_at, ai_paused, ai_paused_at, external_emails_paused, external_emails_paused_at, maintenance_mode, maintenance_mode_at")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export const dynamic = "force-dynamic"
