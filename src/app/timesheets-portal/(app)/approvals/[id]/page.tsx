import { notFound } from "next/navigation"
import Link from "next/link"
import { requireSupervisorAuth } from "@/lib/auth-helpers"
import { createAdminClient } from "@/lib/supabase/admin"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChevronLeft } from "lucide-react"
import { ApprovalActions } from "./ApprovalActions"

const STATUS_BADGE: Record<string, string> = {
  submitted: "bg-blue-50 text-blue-700 border-blue-200",
  approved:  "bg-green-50 text-green-700 border-green-200",
  declined:  "bg-red-50 text-red-700 border-red-200",
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

export default async function ApprovalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireSupervisorAuth()
  const { id } = await params

  const admin = createAdminClient()
  const ts = admin.schema("timesheets")

  const { data: supervisor } = await ts.from("supervisors").select("id").eq("user_id", user.id).single()
  if (!supervisor) notFound()

  const { data: timesheet } = await ts.from("timesheets").select("*").eq("id", id).single()
  if (!timesheet || timesheet.supervisor_id !== supervisor.id) notFound()

  const { data: contractor } = await ts.from("contractors").select("full_name, email").eq("id", timesheet.contractor_id).single()
  const { data: entries } = await ts.from("timesheet_entries").select("*").eq("timesheet_id", id).order("work_date")

  const total = (entries ?? []).reduce((sum, e) => sum + Number(e.hours), 0)

  return (
    <div>
      <Link href="/approvals" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 w-fit">
        <ChevronLeft className="h-3.5 w-3.5" />Approvals
      </Link>

      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{contractor?.full_name ?? "Unknown"}</h1>
          <p className="text-sm text-muted-foreground">Week of {timesheet.week_starting}</p>
        </div>
        <Badge variant="outline" className={`text-xs ${STATUS_BADGE[timesheet.status] ?? ""}`}>{timesheet.status}</Badge>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Daily hours</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(entries ?? []).map((e) => {
              const dayIndex = Math.round((new Date(e.work_date).getTime() - new Date(timesheet.week_starting).getTime()) / 86400000)
              return (
                <div key={e.id} className="grid grid-cols-[3rem_4rem_1fr] gap-3 text-sm border-b last:border-0 pb-2 last:pb-0">
                  <span className="text-muted-foreground">{DAY_LABELS[dayIndex] ?? e.work_date}</span>
                  <span>{Number(e.hours).toFixed(2)} hrs</span>
                  <span className="text-muted-foreground truncate">{e.description ?? "—"}</span>
                </div>
              )
            })}
          </div>
          <div className="flex justify-end mt-3 pt-3 border-t text-sm font-medium">Total: {total.toFixed(2)} hrs</div>
        </CardContent>
      </Card>

      {timesheet.status === "submitted" && <ApprovalActions timesheetId={id} />}

      {timesheet.status === "declined" && timesheet.decline_reason && (
        <div className="rounded-md bg-red-50 border border-red-200 px-3 py-3 text-sm text-red-800 mt-4">
          <p className="font-medium mb-0.5">Declined</p>
          <p>{timesheet.decline_reason}</p>
        </div>
      )}
    </div>
  )
}
