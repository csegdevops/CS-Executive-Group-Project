import { redirect } from "next/navigation"
import Link from "next/link"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAuth, getUserPermissionKeys, hasPermission } from "@/lib/auth-helpers"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardContent } from "@/components/ui/card"
import { ModuleToggleList } from "./ModuleToggleList"
import { EmailPauseToggle } from "./EmailPauseToggle"
import { ExternalEmailPauseToggle } from "./ExternalEmailPauseToggle"
import { AiPauseToggle } from "./AiPauseToggle"
import { MaintenanceModeToggle } from "./MaintenanceModeToggle"
import { Users2, ListChecks, Globe, Mail, ChevronRight } from "lucide-react"
import type { ModuleConfig } from "@/types/database"

export default async function PlatformSettingsPage() {
  const user = await requireAuth()
  const isSuperAdmin = user.role === "super_admin"
  const keys = isSuperAdmin ? [] : await getUserPermissionKeys(user.id)
  const canViewSettings = isSuperAdmin || hasPermission(keys, "platform_settings.view")
  const canManageAiPause = isSuperAdmin || hasPermission(keys, "ai.pause.manage")

  if (!canViewSettings && !canManageAiPause) redirect("/home")

  const admin = createAdminClient()

  // ai.pause.manage-only holders (no platform_settings.view) get just the AI
  // pause toggle — everything else on this page is genuinely platform-admin scoped.
  if (!canViewSettings) {
    const { data: settings } = await admin.from("system_settings").select("ai_paused").eq("id", true).single()
    return (
      <div className="max-w-2xl space-y-6">
        <PageHeader title="AI Controls" description="Pause or resume AI features platform-wide." />
        <AiPauseToggle initialPaused={settings?.ai_paused ?? false} />
      </div>
    )
  }

  const [{ data }, { data: settings }] = await Promise.all([
    admin.from("module_config").select("module, is_enabled, updated_at").order("module"),
    admin.from("system_settings").select("emails_paused, ai_paused, external_emails_paused, maintenance_mode").eq("id", true).single(),
  ])

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title="Platform Settings"
        description="Control which modules are available across the platform."
      />

      {isSuperAdmin && <MaintenanceModeToggle initialEnabled={settings?.maintenance_mode ?? false} />}

      <EmailPauseToggle initialPaused={settings?.emails_paused ?? false} />

      <ExternalEmailPauseToggle initialPaused={settings?.external_emails_paused ?? true} />

      <AiPauseToggle initialPaused={settings?.ai_paused ?? false} />

      <Link href="/admin/settings/groups">
        <Card className="hover:bg-muted/40 transition-colors cursor-pointer">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <Users2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Security Groups</p>
                <p className="text-xs text-muted-foreground">
                  Manage permission groups and the platform users assigned to them.
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </CardContent>
        </Card>
      </Link>

      <Link href="/admin/settings/email-templates">
        <Card className="hover:bg-muted/40 transition-colors cursor-pointer">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Email Templates</p>
                <p className="text-xs text-muted-foreground">
                  Edit the subject, body, and CC/BCC recipients for outgoing emails.
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </CardContent>
        </Card>
      </Link>

      <Link href="/admin/settings/reference-data">
        <Card className="hover:bg-muted/40 transition-colors cursor-pointer">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <ListChecks className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Reference Data</p>
                <p className="text-xs text-muted-foreground">
                  Manage dropdown options across all modules.
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </CardContent>
        </Card>
      </Link>

      <Link href="/admin/settings/domains">
        <Card className="hover:bg-muted/40 transition-colors cursor-pointer">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <Globe className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Access Domains</p>
                <p className="text-xs text-muted-foreground">
                  Manage allowed email domains for sign-up.
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </CardContent>
        </Card>
      </Link>

      <ModuleToggleList configs={(data ?? []) as ModuleConfig[]} />
    </div>
  )
}
