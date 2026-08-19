import { createClient } from "@/lib/supabase/server"
import { requireModuleAccess, getUserPermissionKeys, hasPermission } from "@/lib/auth-helpers"
import { PageHeader } from "@/components/layout/PageHeader"
import { VpnAccountFormDialog } from "./VpnAccountFormDialog"
import { DeleteVpnAccountButton } from "./DeleteVpnAccountButton"

export default async function VpnPage() {
  const user = await requireModuleAccess("ims")
  const isSuperAdmin = user.role === "super_admin"
  const keys = isSuperAdmin ? [] : await getUserPermissionKeys(user.id)
  const canManage = isSuperAdmin || hasPermission(keys, "ims.vpn.manage")

  const supabase = await createClient()
  const { data: accounts } = await supabase
    .schema("ims")
    .from("vpn_accounts")
    .select("*")
    .order("vpn_username")

  const userIds = [...new Set((accounts ?? []).map((a) => a.user_id))]
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", userIds)
    : { data: [] }
  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.full_name]))

  return (
    <div>
      <PageHeader title="VPN Accounts" description="VPN usernames per user">
        {canManage && <VpnAccountFormDialog />}
      </PageHeader>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium">User</th>
              <th className="text-left px-4 py-3 font-medium">Provider</th>
              <th className="text-left px-4 py-3 font-medium">VPN username</th>
              <th className="text-left px-4 py-3 font-medium">Vault reference</th>
              <th className="text-left px-4 py-3 font-medium">Last rotated</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {(accounts ?? []).map((a) => (
              <tr key={a.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-medium">{profileMap[a.user_id] ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{a.vpn_provider}</td>
                <td className="px-4 py-3 text-muted-foreground">{a.vpn_username}</td>
                <td className="px-4 py-3 text-muted-foreground">{a.vault_reference ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{a.last_rotated_at ?? "—"}</td>
                <td className="px-4 py-3 text-right">
                  {canManage && (
                    <div className="flex items-center justify-end gap-1">
                      <VpnAccountFormDialog account={a} />
                      <DeleteVpnAccountButton id={a.id} username={a.vpn_username} />
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!(accounts?.length) && (
          <div className="text-center py-10 text-muted-foreground text-sm">No VPN accounts yet.</div>
        )}
      </div>
    </div>
  )
}
