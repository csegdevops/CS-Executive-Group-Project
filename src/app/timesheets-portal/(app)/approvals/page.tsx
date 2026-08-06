import Link from "next/link"
import { requireSupervisorAuth } from "@/lib/auth-helpers"
import { createAdminClient } from "@/lib/supabase/admin"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const STATUS_BADGE: Record<string, string> = {
  submitted: "bg-blue-50 text-blue-700 border-blue-200",
  approved:  "bg-green-50 text-green-700 border-green-200",
  declined:  "bg-red-50 text-red-700 border-red-200",
}

export default async function ApprovalsPage() {
  const user = await requireSupervisorAuth()
  const admin = createAdminClient()
  const ts = admin.schema("timesheets")

  const { data: supervisor } = await ts.from("supervisors").select("id").eq("user_id", user.id).single()
  if (!supervisor) {
    return <p className="text-sm text-muted-foreground">Your supervisor record could not be found. Contact your account manager.</p>
  }

  const { data: contractorIdsRows } = await ts
    .from("supervisor_assignments")
    .select("contractor_id")
    .eq("supervisor_id", supervisor.id)
    .is("end_date", null)
  const contractorIds = (contractorIdsRows ?? []).map((r) => r.contractor_id)

  const { data: contractors } = contractorIds.length
    ? await ts.from("contractors").select("id, full_name").in("id", contractorIds)
    : { data: [] }
  const contractorMap = Object.fromEntries((contractors ?? []).map((c) => [c.id, c.full_name]))

  const { data: timesheets } = contractorIds.length
    ? await ts
        .from("timesheets")
        .select("id, contractor_id, week_starting, status, submitted_at")
        .in("contractor_id", contractorIds)
        .in("status", ["submitted", "approved", "declined"])
        .order("submitted_at", { ascending: false })
    : { data: [] }

  const pending = (timesheets ?? []).filter((t) => t.status === "submitted")
  const decided = (timesheets ?? []).filter((t) => t.status !== "submitted").slice(0, 20)

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold tracking-tight">Approvals</h1>

      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-2">Pending ({pending.length})</h2>
        {pending.length === 0 ? (
          <div className="border rounded-lg text-center py-10 text-muted-foreground text-sm">Nothing waiting on you.</div>
        ) : (
          <div className="space-y-2">
            {pending.map((t) => (
              <Link key={t.id} href={`/approvals/${t.id}`}>
                <Card className="hover:bg-muted/40 transition-colors cursor-pointer">
                  <CardContent className="flex items-center justify-between py-4">
                    <div>
                      <p className="font-medium text-sm">{contractorMap[t.contractor_id] ?? "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">Week of {t.week_starting}</p>
                    </div>
                    <Badge variant="outline" className={`text-xs ${STATUS_BADGE[t.status]}`}>{t.status}</Badge>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {decided.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-2">Recent</h2>
          <div className="space-y-2">
            {decided.map((t) => (
              <Link key={t.id} href={`/approvals/${t.id}`}>
                <Card className="hover:bg-muted/40 transition-colors cursor-pointer">
                  <CardContent className="flex items-center justify-between py-4">
                    <div>
                      <p className="font-medium text-sm">{contractorMap[t.contractor_id] ?? "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">Week of {t.week_starting}</p>
                    </div>
                    <Badge variant="outline" className={`text-xs ${STATUS_BADGE[t.status]}`}>{t.status}</Badge>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
