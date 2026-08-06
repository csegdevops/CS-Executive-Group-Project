import { notFound } from "next/navigation"
import Link from "next/link"
import { requireContractorAuth } from "@/lib/auth-helpers"
import { createAdminClient } from "@/lib/supabase/admin"
import { ChevronLeft } from "lucide-react"
import { TimesheetEntryForm } from "./TimesheetEntryForm"

export default async function TimesheetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireContractorAuth()
  const { id } = await params

  const admin = createAdminClient()
  const ts = admin.schema("timesheets")

  const { data: contractor } = await ts.from("contractors").select("id").eq("user_id", user.id).single()
  if (!contractor) notFound()

  const { data: timesheet } = await ts.from("timesheets").select("*").eq("id", id).single()
  if (!timesheet || timesheet.contractor_id !== contractor.id) notFound()

  const { data: entries } = await ts.from("timesheet_entries").select("*").eq("timesheet_id", id).order("work_date")

  return (
    <div>
      <Link href="/my-timesheets" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 w-fit">
        <ChevronLeft className="h-3.5 w-3.5" />My Timesheets
      </Link>
      <TimesheetEntryForm timesheet={timesheet} initialEntries={entries ?? []} />
    </div>
  )
}
