import { redirect } from "next/navigation"
import Link from "next/link"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAuth, getUserPermissionKeys, hasPermission } from "@/lib/auth-helpers"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/date-helpers"
import { EMAIL_TEMPLATE_REGISTRY, type EmailTemplateModule } from "@/lib/email/template-registry"
import { BackButton } from "./BackButton"
import { ChevronRight } from "lucide-react"

const MODULE_ORDER: EmailTemplateModule[] = ["regulatory", "recruitment", "timesheets"]
const MODULE_LABELS: Record<EmailTemplateModule, string> = {
  regulatory: "Regulatory",
  recruitment: "Recruitment",
  timesheets: "Timesheets",
}

export default async function EmailTemplatesPage() {
  const user = await requireAuth()
  const isSuperAdmin = user.role === "super_admin"
  const keys = isSuperAdmin ? [] : await getUserPermissionKeys(user.id)
  const canView = isSuperAdmin || hasPermission(keys, "platform_settings.view")
  const canManage = isSuperAdmin || hasPermission(keys, "platform_settings.email_templates.manage")
  if (!canView) redirect("/home")

  const admin = createAdminClient()
  const { data: rows } = await admin
    .from("email_templates")
    .select("template_key, subject, updated_at, updated_by")

  const byKey = new Map((rows ?? []).map((r) => [r.template_key, r]))

  const updaterIds = [...new Set((rows ?? []).map((r) => r.updated_by).filter((v): v is string => !!v))]
  const { data: profiles } = updaterIds.length
    ? await admin.from("profiles").select("id, full_name").in("id", updaterIds)
    : { data: [] }
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]))

  return (
    <div className="max-w-3xl space-y-6">
      <BackButton href="/admin/settings" label="Platform Settings" />
      <PageHeader
        title="Email Templates"
        description={
          canManage
            ? "Edit the subject, body, and CC/BCC recipients for every outgoing email."
            : "View the subject, body, and CC/BCC recipients for every outgoing email."
        }
      />

      {MODULE_ORDER.map((mod) => {
        const templates = EMAIL_TEMPLATE_REGISTRY.filter((t) => t.module === mod)
        return (
          <div key={mod} className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{MODULE_LABELS[mod]}</p>
            <div className="space-y-2">
              {templates.map((t) => {
                const row = byKey.get(t.key)
                const updaterName = row?.updated_by ? nameById.get(row.updated_by) ?? "—" : null
                return (
                  <Link key={t.key} href={`/admin/settings/email-templates/${t.key}`}>
                    <Card className="hover:bg-muted/40 transition-colors cursor-pointer">
                      <CardContent className="flex items-center justify-between py-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{t.label}</p>
                            {!canManage && <Badge variant="outline" className="text-xs">View only</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{t.trigger}</p>
                          {row?.updated_at && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Last edited {formatDate(row.updated_at)}{updaterName ? ` by ${updaterName}` : ""}
                            </p>
                          )}
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </CardContent>
                    </Card>
                  </Link>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
