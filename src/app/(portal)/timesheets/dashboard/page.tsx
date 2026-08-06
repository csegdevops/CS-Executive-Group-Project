import Link from "next/link"
import { requireModuleAccess } from "@/lib/auth-helpers"
import { createAdminClient } from "@/lib/supabase/admin"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardContent } from "@/components/ui/card"
import { UserCheck, FileSignature, ClipboardList, Contact } from "lucide-react"

export default async function TimesheetsDashboardPage() {
  await requireModuleAccess("timesheets")
  const admin = createAdminClient()
  const ts = admin.schema("timesheets")

  const [{ count: activeContractors }, { count: activeContracts }, { count: pendingApprovals }, { count: supervisors }] = await Promise.all([
    ts.from("contractors").select("id", { count: "exact", head: true }).eq("is_active", true),
    ts.from("contracts").select("id", { count: "exact", head: true }).eq("status", "active"),
    ts.from("timesheets").select("id", { count: "exact", head: true }).eq("status", "submitted"),
    ts.from("supervisors").select("id", { count: "exact", head: true }).eq("is_active", true),
  ])

  const stats = [
    { label: "Active Contractors", value: activeContractors ?? 0, href: "/timesheets/contractors", icon: UserCheck },
    { label: "Active Contracts", value: activeContracts ?? 0, href: "/timesheets/contracts", icon: FileSignature },
    { label: "Pending Approvals", value: pendingApprovals ?? 0, href: "/timesheets/timesheets?status=submitted", icon: ClipboardList },
    { label: "Supervisors", value: supervisors ?? 0, href: "/timesheets/supervisors", icon: Contact },
  ]

  return (
    <div>
      <PageHeader title="Timesheets" description="Contractor timesheets, approvals, and contracts" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(({ label, value, href, icon: Icon }) => (
          <Link key={label} href={href}>
            <Card className="hover:bg-muted/40 transition-colors cursor-pointer">
              <CardContent className="py-5">
                <Icon className="h-5 w-5 text-muted-foreground mb-2" />
                <p className="text-2xl font-semibold tracking-tight">{value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
