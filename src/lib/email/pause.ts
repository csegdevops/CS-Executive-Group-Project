import { createAdminClient } from "@/lib/supabase/admin"

// Server-only. Checked by every send()/invite-triggering call site before it
// talks to Resend or Supabase Auth — see admin/settings' "Pause all emails"
// toggle. Queried fresh each call (no caching) so flipping the toggle takes
// effect immediately for in-flight requests.
export async function isEmailPaused(): Promise<boolean> {
  const admin = createAdminClient()
  const { data } = await admin.from("system_settings").select("emails_paused").eq("id", true).single()
  return data?.emails_paused ?? false
}
