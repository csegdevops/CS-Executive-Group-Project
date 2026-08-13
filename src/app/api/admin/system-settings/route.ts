import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requirePermissionOrSuperAdmin } from "@/lib/auth-helpers"
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
    .select("emails_paused, emails_paused_at, ai_paused, ai_paused_at")
    .eq("id", true)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

const patchSchema = z.object({
  emails_paused: z.boolean().optional(),
  ai_paused: z.boolean().optional(),
}).refine((v) => v.emails_paused !== undefined || v.ai_paused !== undefined, {
  message: "At least one of emails_paused, ai_paused must be provided",
})

// PATCH /api/admin/system-settings — the "Pause all emails" / "Pause all AI
// features" toggles. Either field may be sent independently.
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await requirePermissionOrSuperAdmin(supabase, user.id, "platform_settings.manage"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const userId = user.id

  const body = await request.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { emails_paused, ai_paused } = parsed.data
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

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("system_settings")
    .update(update)
    .eq("id", true)
    .select("emails_paused, emails_paused_at, ai_paused, ai_paused_at")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export const dynamic = "force-dynamic"
