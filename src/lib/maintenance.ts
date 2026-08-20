import { createAdminClient } from "@/lib/supabase/admin"

// Server-only. Checked on every request in src/proxy.ts to gate the whole
// portal to super admins — queried fresh each call (no caching), matching
// the pause switches in src/lib/email/pause.ts, so flipping it takes effect
// immediately. Page-level only: API routes don't consult this.
export async function isMaintenanceMode(): Promise<boolean> {
  const admin = createAdminClient()
  const { data } = await admin.from("system_settings").select("maintenance_mode").eq("id", true).single()
  return data?.maintenance_mode ?? false
}
