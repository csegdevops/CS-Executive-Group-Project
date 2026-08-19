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

// Second, independent switch — covers only email sent to people outside the
// organisation (candidates, contractors, supervisors). Staff-to-staff email
// (src/lib/email/notifications.ts) ignores this and only respects
// isEmailPaused(). Call sites that send externally should check both.
export async function isExternalEmailPaused(): Promise<boolean> {
  const admin = createAdminClient()
  const { data } = await admin.from("system_settings").select("external_emails_paused").eq("id", true).single()
  return data?.external_emails_paused ?? true
}
