import { createClient } from "@/lib/supabase/server"
import { requireModuleAccess, getUserPermissionKeys, hasPermission } from "@/lib/auth-helpers"
import { PageHeader } from "@/components/layout/PageHeader"
import { ServiceAccountFormDialog } from "./ServiceAccountFormDialog"
import { DeleteServiceAccountButton } from "./DeleteServiceAccountButton"

export default async function ServiceAccountsPage() {
  const user = await requireModuleAccess("ims")
  const isSuperAdmin = user.role === "super_admin"
  const keys = isSuperAdmin ? [] : await getUserPermissionKeys(user.id)
  const canManage = isSuperAdmin || hasPermission(keys, "ims.service_accounts.manage")

  const supabase = await createClient()
  const { data: accounts } = await supabase
    .schema("ims")
    .from("service_accounts")
    .select("*")
    .order("service_name")

  const assignedIds = [...new Set((accounts ?? []).map((a) => a.assigned_to).filter(Boolean))] as string[]
  const { data: profiles } = assignedIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", assignedIds)
    : { data: [] }
  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.full_name]))

  return (
    <div>
      <PageHeader title="Service Accounts" description="Website & third-party service logins">
        {canManage && <ServiceAccountFormDialog />}
      </PageHeader>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Service</th>
              <th className="text-left px-4 py-3 font-medium">Username</th>
              <th className="text-left px-4 py-3 font-medium">Owner</th>
              <th className="text-left px-4 py-3 font-medium">Vault reference</th>
              <th className="text-left px-4 py-3 font-medium">Last rotated</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {(accounts ?? []).map((a) => (
              <tr key={a.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-medium">{a.service_name}</div>
                  {a.service_url && <div className="text-xs text-muted-foreground">{a.service_url}</div>}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{a.account_username ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{a.assigned_to ? profileMap[a.assigned_to] ?? "—" : "Shared"}</td>
                <td className="px-4 py-3 text-muted-foreground">{a.vault_reference ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{a.last_rotated_at ?? "—"}</td>
                <td className="px-4 py-3 text-right">
                  {canManage && (
                    <div className="flex items-center justify-end gap-1">
                      <ServiceAccountFormDialog account={a} />
                      <DeleteServiceAccountButton id={a.id} serviceName={a.service_name} />
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!(accounts?.length) && (
          <div className="text-center py-10 text-muted-foreground text-sm">No service accounts yet.</div>
        )}
      </div>
    </div>
  )
}
