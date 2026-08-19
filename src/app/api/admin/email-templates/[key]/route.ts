import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requirePermissionOrSuperAdmin } from "@/lib/auth-helpers"
import { getTemplateMeta } from "@/lib/email/template-registry"
import { NextResponse } from "next/server"
import { z } from "zod"

const patchSchema = z.object({
  subject: z.string().min(1),
  body_html: z.string().min(1),
  body_text: z.string().min(1),
  cc_group_ids: z.array(z.string().uuid()),
  bcc_group_ids: z.array(z.string().uuid()),
})

// PATCH /api/admin/email-templates/[key]
export async function PATCH(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  if (!getTemplateMeta(key)) return NextResponse.json({ error: "Unknown template" }, { status: 404 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!(await requirePermissionOrSuperAdmin(supabase, user.id, "platform_settings.email_templates.manage"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await request.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("email_templates")
    .update({ ...parsed.data, updated_by: user.id, updated_at: new Date().toISOString() })
    .eq("template_key", key)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export const dynamic = "force-dynamic"
