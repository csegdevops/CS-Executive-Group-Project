import Link from "next/link"
import { createAdminClient } from "@/lib/supabase/admin"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ModuleToggleList } from "./ModuleToggleList"
import { Users2, ListChecks, Globe, Clock, ChevronRight } from "lucide-react"
import type { ModuleConfig } from "@/types/database"

export default async function PlatformSettingsPage() {
  const admin = createAdminClient()
  const { data } = await admin
    .from("module_config")
    .select("module, is_enabled, updated_at")
    .order("module")

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title="Platform Settings"
        description="Control which modules are available across the platform."
      />

      <Link href="/admin/settings/groups">
        <Card className="hover:bg-muted/40 transition-colors cursor-pointer">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <Users2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">User Groups</p>
                <p className="text-xs text-muted-foreground">
                  Create and manage groups that grant module access to users.
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

      <Link href="/admin/domains">
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

      <Card className="opacity-60">
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Timesheets</p>
              <p className="text-xs text-muted-foreground">
                Contractor timesheets, approvals, and contracts — coming soon.
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-xs text-muted-foreground">Coming soon</Badge>
        </CardContent>
      </Card>

      <ModuleToggleList configs={(data ?? []) as ModuleConfig[]} />
    </div>
  )
}
