import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requirePermissionOrSuperAdmin } from "@/lib/auth-helpers"
import { NextResponse } from "next/server"
import { z } from "zod"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data, error } = await supabase
    .from("module_config")
    .select("module, is_enabled, updated_at")
    .order("module")
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

const patchSchema = z.object({
  module:     z.enum(["regulatory", "recruitment", "timesheets"]),
  is_enabled: z.boolean(),
})

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await requirePermissionOrSuperAdmin(supabase, user.id, "platform_settings.manage"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await request.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { module, is_enabled } = parsed.data
  const admin = createAdminClient()
  const { error } = await admin
    .from("module_config")
    .update({ is_enabled })
    .eq("module", module)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ module, is_enabled })
}

export const dynamic = "force-dynamic"
