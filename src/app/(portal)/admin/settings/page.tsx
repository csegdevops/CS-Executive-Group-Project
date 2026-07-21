import { createAdminClient } from "@/lib/supabase/admin"
import { PageHeader } from "@/components/layout/PageHeader"
import { ModuleToggleList } from "./ModuleToggleList"
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
      <ModuleToggleList configs={(data ?? []) as ModuleConfig[]} />
    </div>
  )
}
