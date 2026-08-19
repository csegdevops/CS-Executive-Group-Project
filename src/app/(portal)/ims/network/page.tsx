import { createClient } from "@/lib/supabase/server"
import { requireModuleAccess, getUserPermissionKeys, hasPermission } from "@/lib/auth-helpers"
import { PageHeader } from "@/components/layout/PageHeader"
import { WifiFormDialog } from "./WifiFormDialog"
import { DeleteWifiButton } from "./DeleteWifiButton"

export default async function NetworkPage() {
  const user = await requireModuleAccess("ims")
  const isSuperAdmin = user.role === "super_admin"
  const keys = isSuperAdmin ? [] : await getUserPermissionKeys(user.id)
  const canManage = isSuperAdmin || hasPermission(keys, "ims.network.manage")

  const supabase = await createClient()
  const { data: networks } = await supabase
    .schema("ims")
    .from("wifi_networks")
    .select("*")
    .order("ssid")

  return (
    <div>
      <PageHeader title="Network" description="Office wifi & router controls">
        {canManage && <WifiFormDialog />}
      </PageHeader>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium">SSID</th>
              <th className="text-left px-4 py-3 font-medium">Location</th>
              <th className="text-left px-4 py-3 font-medium">Router</th>
              <th className="text-left px-4 py-3 font-medium">Management IP</th>
              <th className="text-left px-4 py-3 font-medium">Last rotated</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {(networks ?? []).map((n) => (
              <tr key={n.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-medium">{n.ssid}</td>
                <td className="px-4 py-3 text-muted-foreground">{n.location ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{[n.router_make, n.router_model].filter(Boolean).join(" ") || "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{n.router_management_ip ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{n.last_rotated_at ?? "—"}</td>
                <td className="px-4 py-3 text-right">
                  {canManage && (
                    <div className="flex items-center justify-end gap-1">
                      <WifiFormDialog network={n} />
                      <DeleteWifiButton id={n.id} ssid={n.ssid} />
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!(networks?.length) && (
          <div className="text-center py-10 text-muted-foreground text-sm">No networks yet.</div>
        )}
      </div>
    </div>
  )
}
