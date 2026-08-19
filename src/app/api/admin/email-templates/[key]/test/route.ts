import { createClient } from "@/lib/supabase/server"
import { requirePermissionOrSuperAdmin } from "@/lib/auth-helpers"
import { getTemplateMeta } from "@/lib/email/template-registry"
import { sendTemplatedEmail } from "@/lib/email/send-templated"
import { NextResponse } from "next/server"
import { z } from "zod"

const testSchema = z.object({
  subject: z.string().min(1),
  body_html: z.string().min(1),
  body_text: z.string().min(1),
})

// POST /api/admin/email-templates/[key]/test — sends the given (possibly
// unsaved-draft) subject/body to the requesting user's own address using
// registry sample values, so an editor can see text vs. HTML rendering in a
// real inbox before saving. CC/BCC groups still come from the saved row.
export async function POST(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  const meta = getTemplateMeta(key)
  if (!meta) return NextResponse.json({ error: "Unknown template" }, { status: 404 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!(await requirePermissionOrSuperAdmin(supabase, user.id, "platform_settings.email_templates.manage"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await request.json()
  const parsed = testSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const sent = await sendTemplatedEmail(key, meta.sampleValues, { to: user.email, contentOverride: parsed.data })
  if (!sent) return NextResponse.json({ error: "Send failed or emails are paused — check Platform Settings" }, { status: 502 })
  return NextResponse.json({ sent: true })
}

export const dynamic = "force-dynamic"
