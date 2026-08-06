import { requireContractorAuth } from "@/lib/auth-helpers"
import { createAdminClient } from "@/lib/supabase/admin"
import { MyTimesheetsClient } from "./MyTimesheetsClient"

export default async function MyTimesheetsPage() {
  const user = await requireContractorAuth()
  const admin = createAdminClient()
  const ts = admin.schema("timesheets")

  const { data: contractor } = await ts.from("contractors").select("id, full_name").eq("user_id", user.id).single()
  if (!contractor) {
    return <p className="text-sm text-muted-foreground">Your contractor record could not be found. Contact your account manager.</p>
  }

  const { data: timesheets } = await ts
    .from("timesheets")
    .select("id, week_starting, status, decline_reason, is_template, submitted_at")
    .eq("contractor_id", contractor.id)
    .order("week_starting", { ascending: false })

  const weeks = (timesheets ?? []).filter((t) => !t.is_template)
  const templates = (timesheets ?? []).filter((t) => t.is_template)

  return <MyTimesheetsClient weeks={weeks} templates={templates} />
}
