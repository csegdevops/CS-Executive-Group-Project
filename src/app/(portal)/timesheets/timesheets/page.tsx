import { requireModuleAccess } from "@/lib/auth-helpers"
import { createAdminClient } from "@/lib/supabase/admin"
import { PageHeader } from "@/components/layout/PageHeader"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { cn } from "@/lib/utils"
import type { TimesheetStatus } from "@/types/database"

const VALID_STATUSES: TimesheetStatus[] = ["draft", "submitted", "approved", "declined"]

const STATUS_BADGE: Record<string, string> = {
  draft:     "bg-muted text-muted-foreground border-border",
  submitted: "bg-blue-50 text-blue-700 border-blue-200",
  approved:  "bg-green-50 text-green-700 border-green-200",
  declined:  "bg-red-50 text-red-700 border-red-200",
}

const FILTERS: { label: string; value: string | null }[] = [
  { label: "All",       value: null },
  { label: "Submitted", value: "submitted" },
  { label: "Approved",  value: "approved" },
  { label: "Declined",  value: "declined" },
]

export default async function TimesheetsOversightPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireModuleAccess("timesheets")
  const { status } = await searchParams

  const admin = createAdminClient()
  const ts = admin.schema("timesheets")

  let query = ts
    .from("timesheets")
    .select("id, contractor_id, week_starting, status, submitted_at")
    .eq("is_template", false)
    .order("submitted_at", { ascending: false, nullsFirst: false })
  if (status && VALID_STATUSES.includes(status as TimesheetStatus)) {
    query = query.eq("status", status as TimesheetStatus)
  }

  const { data: timesheets } = await query

  const contractorIds = [...new Set((timesheets ?? []).map((t) => t.contractor_id))]
  const { data: contractors } = contractorIds.length
    ? await ts.from("contractors").select("id, full_name, company_id").in("id", contractorIds)
    : { data: [] }
  const contractorMap = Object.fromEntries((contractors ?? []).map((c) => [c.id, c]))

  const companyIds = [...new Set((contractors ?? []).map((c) => c.company_id))]
  const { data: companies } = companyIds.length
    ? await admin.from("companies").select("id, name").in("id", companyIds)
    : { data: [] }
  const companyMap = Object.fromEntries((companies ?? []).map((c) => [c.id, c.name]))

  return (
    <div>
      <PageHeader title="Timesheets" description="Oversight across every contractor" />

      <div className="flex gap-1 mb-4 border-b">
        {FILTERS.map((f) => (
          <Link
            key={f.label}
            href={f.value ? `/timesheets/timesheets?status=${f.value}` : "/timesheets/timesheets"}
            className={cn(
              "px-3 py-2 text-sm font-medium border-b-2 -mb-px",
              (status ?? null) === f.value ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {(timesheets ?? []).length === 0 ? (
        <div className="border rounded-lg text-center py-16 text-muted-foreground text-sm">No timesheets found.</div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Contractor</th>
                <th className="text-left px-4 py-3 font-medium">Company</th>
                <th className="text-left px-4 py-3 font-medium">Week</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(timesheets ?? []).map((t) => {
                const contractor = contractorMap[t.contractor_id]
                return (
                  <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/timesheets/contractors/${t.contractor_id}`} className="font-medium hover:underline">
                        {contractor?.full_name ?? "Unknown"}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{contractor ? companyMap[contractor.company_id] ?? "—" : "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{t.week_starting}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={`text-xs ${STATUS_BADGE[t.status] ?? ""}`}>{t.status}</Badge>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
