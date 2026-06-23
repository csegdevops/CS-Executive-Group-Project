import { createAdminClient } from "@/lib/supabase/admin"

export async function logConsultationEvent(
  consultationId: string,
  userId: string,
  action: string,
  details?: Record<string, unknown>
) {
  const admin = createAdminClient()
  await admin.schema("regulatory").from("consultation_logs").insert({
    consultation_id: consultationId,
    user_id:         userId,
    action,
    details:         details ?? null,
  })
}
