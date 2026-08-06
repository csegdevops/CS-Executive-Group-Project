import Link from "next/link"
import { requireModuleAccess } from "@/lib/auth-helpers"
import { createAdminClient } from "@/lib/supabase/admin"
import { PageHeader } from "@/components/layout/PageHeader"
import { Badge } from "@/components/ui/badge"

const STATUS_BADGE: Record<string, string> = {
  active:     "bg-green-50 text-green-700 border-green-200",
  expired:    "bg-amber-50 text-amber-700 border-amber-200",
  terminated: "bg-red-50 text-red-700 border-red-200",
}

export default async function ContractsPage() {
  await requireModuleAccess("timesheets")
  const admin = createAdminClient()
  const ts = admin.schema("timesheets")

  const { data: contracts } = await ts
    .from("contracts")
    .select("id, contractor_id, start_date, finish_date, pay_rate, charge_rate, currency, status")
    .order("start_date", { ascending: false })

  const contractorIds = [...new Set((contracts ?? []).map((c) => c.contractor_id))]
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
      <PageHeader title="Contracts" description="All contractor engagements — open a contractor to extend or terminate" />

      {(contracts ?? []).length === 0 ? (
        <div className="border rounded-lg text-center py-16 text-muted-foreground text-sm">No contracts yet.</div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Contractor</th>
                <th className="text-left px-4 py-3 font-medium">Company</th>
                <th className="text-left px-4 py-3 font-medium">Start</th>
                <th className="text-left px-4 py-3 font-medium">Finish</th>
                <th className="text-left px-4 py-3 font-medium">Rates</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(contracts ?? []).map((c) => {
                const contractor = contractorMap[c.contractor_id]
                return (
                  <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/timesheets/contractors/${c.contractor_id}`} className="font-medium hover:underline">
                        {contractor?.full_name ?? "Unknown"}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{contractor ? companyMap[contractor.company_id] ?? "—" : "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.start_date}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.finish_date ?? "Ongoing"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.pay_rate ?? "—"} / {c.charge_rate ?? "—"} {c.currency}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={`text-xs ${STATUS_BADGE[c.status] ?? ""}`}>{c.status}</Badge>
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
