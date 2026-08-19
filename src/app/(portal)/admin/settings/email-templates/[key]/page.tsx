import { redirect, notFound } from "next/navigation"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAuth, getUserPermissionKeys, hasPermission } from "@/lib/auth-helpers"
import { PageHeader } from "@/components/layout/PageHeader"
import { getTemplateMeta } from "@/lib/email/template-registry"
import { BackButton } from "../BackButton"
import { EmailTemplateEditor } from "./EmailTemplateEditor"

export default async function EmailTemplateEditorPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  const meta = getTemplateMeta(key)
  if (!meta) notFound()

  const user = await requireAuth()
  const isSuperAdmin = user.role === "super_admin"
  const keys = isSuperAdmin ? [] : await getUserPermissionKeys(user.id)
  const canView = isSuperAdmin || hasPermission(keys, "platform_settings.view")
  const canEdit = isSuperAdmin || hasPermission(keys, "platform_settings.email_templates.manage")
  if (!canView) redirect("/home")

  const admin = createAdminClient()
  const [{ data: template }, { data: groups }] = await Promise.all([
    admin
      .from("email_templates")
      .select("subject, body_html, body_text, cc_group_ids, bcc_group_ids")
      .eq("template_key", key)
      .single(),
    admin.from("user_groups").select("id, name").order("name"),
  ])

  if (!template) notFound()

  return (
    <div className="max-w-4xl space-y-6">
      <BackButton href="/admin/settings/email-templates" label="Email Templates" />
      <PageHeader title={meta.label} description={meta.trigger} />
      <EmailTemplateEditor
        templateKey={key}
        canEdit={canEdit}
        initial={template}
        groups={groups ?? []}
        variables={meta.variables}
        sampleValues={meta.sampleValues}
      />
    </div>
  )
}
