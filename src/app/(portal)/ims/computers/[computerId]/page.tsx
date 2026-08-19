import Link from "next/link"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { requireModuleAccess, getUserPermissionKeys, hasPermission } from "@/lib/auth-helpers"
import { PageHeader } from "@/components/layout/PageHeader"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, ExternalLink } from "lucide-react"
import { ComputerFormDialog } from "../ComputerFormDialog"
import { LoginFormDialog } from "./LoginFormDialog"
import { DeleteLoginButton } from "./DeleteLoginButton"

export default async function ComputerDetailPage({ params }: { params: Promise<{ computerId: string }> }) {
  const user = await requireModuleAccess("ims")
  const isSuperAdmin = user.role === "super_admin"
  const keys = isSuperAdmin ? [] : await getUserPermissionKeys(user.id)
  const canManage = isSuperAdmin || hasPermission(keys, "ims.computers.manage")

  const { computerId } = await params
  const supabase = await createClient()
  const ims = supabase.schema("ims")

  const [{ data: computer }, { data: logins }] = await Promise.all([
    ims.from("computers").select("*").eq("id", computerId).single(),
    ims.from("computer_logins").select("*").eq("computer_id", computerId).order("login_username"),
  ])

  if (!computer) notFound()

  const profileIds = [...new Set([computer.assigned_to, ...(logins ?? []).map((l) => l.user_id)].filter(Boolean))] as string[]
  const { data: profiles } = profileIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", profileIds)
    : { data: [] }
  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.full_name]))

  return (
    <div>
      <Link href="/ims/computers" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground -ml-1 mb-2">
        <ChevronLeft className="h-4 w-4" />Back to Computers
      </Link>

      <PageHeader title={computer.hostname} description={computer.asset_tag ? `Asset tag ${computer.asset_tag}` : undefined}>
        {canManage && <ComputerFormDialog computer={computer} />}
      </PageHeader>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 text-sm">
        <div className="border rounded-lg p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Device</p>
          <p>{computer.device_type.replace(/_/g, " ")}</p>
          {(computer.make || computer.model) && <p className="text-muted-foreground text-xs">{[computer.make, computer.model].filter(Boolean).join(" ")}</p>}
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Status</p>
          <Badge variant="outline" className="text-xs">{computer.status.replace(/_/g, " ")}</Badge>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Assigned to</p>
          <p>{computer.assigned_to ? profileMap[computer.assigned_to] ?? "—" : "Unassigned"}</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Location</p>
          <p>{computer.location ?? "—"}</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Dell service tag</p>
          <p>{computer.service_tag ?? "—"}</p>
          {computer.service_tag && (
            <a
              href="https://www.dell.com/support/home/en-au"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-1"
            >
              <ExternalLink className="h-3 w-3" />
              Check warranty
            </a>
          )}
        </div>
      </div>

      {computer.notes && (
        <div className="border rounded-lg p-4 mb-6 text-sm">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Notes</p>
          <p className="whitespace-pre-wrap">{computer.notes}</p>
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Logins</h2>
        {canManage && <LoginFormDialog computerId={computer.id} />}
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Username</th>
              <th className="text-left px-4 py-3 font-medium">Type</th>
              <th className="text-left px-4 py-3 font-medium">User</th>
              <th className="text-left px-4 py-3 font-medium">Vault reference</th>
              <th className="text-left px-4 py-3 font-medium">Last rotated</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {(logins ?? []).map((l) => (
              <tr key={l.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-medium">{l.login_username}</td>
                <td className="px-4 py-3 text-muted-foreground">{l.login_type.replace(/_/g, " ")}</td>
                <td className="px-4 py-3 text-muted-foreground">{l.user_id ? profileMap[l.user_id] ?? "—" : "Shared"}</td>
                <td className="px-4 py-3 text-muted-foreground">{l.vault_reference ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{l.last_rotated_at ?? "—"}</td>
                <td className="px-4 py-3 text-right">
                  {canManage && (
                    <div className="flex items-center justify-end gap-1">
                      <LoginFormDialog computerId={computer.id} login={l} />
                      <DeleteLoginButton computerId={computer.id} loginId={l.id} username={l.login_username} />
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!(logins?.length) && (
          <div className="text-center py-8 text-muted-foreground text-sm">No logins recorded.</div>
        )}
      </div>
    </div>
  )
}
