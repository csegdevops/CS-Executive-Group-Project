import Link from "next/link"
import { notFound } from "next/navigation"
import { requireModuleAccess } from "@/lib/auth-helpers"
import { createAdminClient } from "@/lib/supabase/admin"
import { PageHeader } from "@/components/layout/PageHeader"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChevronLeft } from "lucide-react"
import { ContractorDetailClient } from "./ContractorDetailClient"

const STATUS_BADGE: Record<string, string> = {
  active:     "bg-green-50 text-green-700 border-green-200",
  expired:    "bg-amber-50 text-amber-700 border-amber-200",
  terminated: "bg-red-50 text-red-700 border-red-200",
}

const TS_STATUS_BADGE: Record<string, string> = {
  draft:     "bg-muted text-muted-foreground border-border",
  submitted: "bg-blue-50 text-blue-700 border-blue-200",
  approved:  "bg-green-50 text-green-700 border-green-200",
  declined:  "bg-red-50 text-red-700 border-red-200",
}

export default async function ContractorDetailPage({ params }: { params: Promise<{ contractorId: string }> }) {
  await requireModuleAccess("timesheets")
  const { contractorId } = await params

  const admin = createAdminClient()
  const ts = admin.schema("timesheets")

  const { data: contractor } = await ts.from("contractors").select("*").eq("id", contractorId).single()
  if (!contractor) notFound()

  const [{ data: company }, { data: branch }, { data: contract }] = await Promise.all([
    admin.from("companies").select("id, name").eq("id", contractor.company_id).single(),
    contractor.branch_id
      ? admin.from("company_branches").select("id, name").eq("id", contractor.branch_id).single()
      : Promise.resolve({ data: null }),
    ts.from("contracts").select("*").eq("contractor_id", contractorId).maybeSingle(),
  ])

  const { data: assignments } = await ts
    .from("supervisor_assignments")
    .select("id, supervisor_id, start_date, end_date")
    .eq("contractor_id", contractorId)
    .order("start_date", { ascending: false })

  const supervisorIds = [...new Set((assignments ?? []).map((a) => a.supervisor_id))]
  const { data: supervisors } = supervisorIds.length
    ? await ts.from("supervisors").select("id, full_name, email").in("id", supervisorIds)
    : { data: [] }
  const supervisorMap = Object.fromEntries((supervisors ?? []).map((s) => [s.id, s]))
  const history = (assignments ?? []).map((a) => ({ ...a, supervisor: supervisorMap[a.supervisor_id] ?? null }))
  const activeAssignment = history.find((a) => !a.end_date) ?? null

  const { data: companySupervisors } = await ts
    .from("supervisors")
    .select("id, full_name, email")
    .eq("company_id", contractor.company_id)
    .eq("is_active", true)

  const { data: timesheets } = await ts
    .from("timesheets")
    .select("id, week_starting, status, submitted_at")
    .eq("contractor_id", contractorId)
    .eq("is_template", false)
    .order("week_starting", { ascending: false })
    .limit(20)

  return (
    <div className="max-w-3xl">
      <Link href="/timesheets/contractors" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2 w-fit">
        <ChevronLeft className="h-3.5 w-3.5" />Contractors
      </Link>
      <PageHeader
        title={contractor.full_name}
        description={`${contractor.email} · ${company?.name ?? "—"}${branch ? ` · ${branch.name}` : ""}`}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Contract</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1.5">
            {contract ? (
              <>
                <div className="flex justify-between"><span className="text-muted-foreground">Status</span>
                  <Badge variant="outline" className={`text-xs ${STATUS_BADGE[contract.status] ?? ""}`}>{contract.status}</Badge>
                </div>
                <div className="flex justify-between"><span className="text-muted-foreground">Start</span><span>{contract.start_date}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Finish</span><span>{contract.finish_date ?? "Ongoing"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Pay / Charge</span>
                  <span>{contract.pay_rate ?? "—"} / {contract.charge_rate ?? "—"} {contract.currency}</span>
                </div>
              </>
            ) : <p className="text-muted-foreground">No contract on file.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Current Supervisor</CardTitle></CardHeader>
          <CardContent className="text-sm">
            {activeAssignment?.supervisor ? (
              <div>
                <p className="font-medium">{activeAssignment.supervisor.full_name}</p>
                <p className="text-xs text-muted-foreground">{activeAssignment.supervisor.email}</p>
              </div>
            ) : (
              <p className="text-muted-foreground">No supervisor assigned.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <ContractorDetailClient
        contractorId={contractorId}
        contract={contract}
        companySupervisors={companySupervisors ?? []}
        activeSupervisorId={activeAssignment?.supervisor_id ?? null}
      />

      {history.length > 0 && (
        <Card className="mt-6">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Supervisor History</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {history.map((h) => (
                <div key={h.id} className="flex items-center justify-between text-sm border-b last:border-0 pb-2 last:pb-0">
                  <span>{h.supervisor?.full_name ?? "Unknown"}</span>
                  <span className="text-xs text-muted-foreground">{h.start_date} – {h.end_date ?? "present"}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Timesheets</CardTitle></CardHeader>
        <CardContent>
          {(timesheets ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No timesheets submitted yet.</p>
          ) : (
            <div className="space-y-2">
              {(timesheets ?? []).map((t) => (
                <div key={t.id} className="flex items-center justify-between text-sm border-b last:border-0 pb-2 last:pb-0">
                  <span>Week of {t.week_starting}</span>
                  <Badge variant="outline" className={`text-xs ${TS_STATUS_BADGE[t.status] ?? ""}`}>{t.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
