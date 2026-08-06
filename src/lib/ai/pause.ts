import { createAdminClient } from "@/lib/supabase/admin"

// Server-only. Checked by every AI call site (CV parsing, formulation AI
// fallback, consultation/company summaries) before it talks to Gemini — see
// admin/settings' "Pause all AI features" toggle. Mirrors isEmailPaused().
// Queried fresh each call (no caching) so flipping the toggle takes effect
// immediately for in-flight requests.
export async function isAiPaused(): Promise<boolean> {
  const admin = createAdminClient()
  const { data } = await admin.from("system_settings").select("ai_paused").eq("id", true).single()
  return data?.ai_paused ?? false
}

export const AI_PAUSED_MESSAGE = "AI features are currently paused by an administrator"
