import { createAdminClient } from "@/lib/supabase/admin"

/**
 * Expands a set of public.user_groups ids into member email addresses, for
 * CC/BCC on admin-configured email templates. Same per-user lookup pattern as
 * notifications.ts's getEmailForUser — profiles has no email column, so each
 * unique member id needs an auth.admin.getUserById round trip.
 */
export async function resolveGroupEmails(groupIds: string[]): Promise<string[]> {
  if (groupIds.length === 0) return []
  const admin = createAdminClient()

  const { data: members } = await admin
    .from("user_group_members")
    .select("user_id")
    .in("group_id", groupIds)

  const userIds = [...new Set((members ?? []).map((m) => m.user_id))]
  if (userIds.length === 0) return []

  const results = await Promise.all(
    userIds.map(async (id) => {
      const { data, error } = await admin.auth.admin.getUserById(id)
      if (error || !data.user?.email) return null
      return data.user.email
    })
  )

  return [...new Set(results.filter((email): email is string => !!email))]
}
