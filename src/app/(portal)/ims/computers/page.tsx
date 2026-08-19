import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { requireModuleAccess, getUserPermissionKeys, hasPermission } from "@/lib/auth-helpers"
import { PageHeader } from "@/components/layout/PageHeader"
import { Badge } from "@/components/ui/badge"
import { ComputerFormDialog } from "./ComputerFormDialog"
import { DeleteComputerButton } from "./DeleteComputerButton"

export default async function ComputersPage() {
  const user = await requireModuleAccess("ims")
  const isSuperAdmin = user.role === "super_admin"
  const keys = isSuperAdmin ? [] : await getUserPermissionKeys(user.id)
  const canManage = isSuperAdmin || hasPermission(keys, "ims.computers.manage")

  const supabase = await createClient()
  const { data: computers } = await supabase
    .schema("ims")
    .from("computers")
    .select("*")
    .order("hostname")

  const assignedIds = [...new Set((computers ?? []).map((c) => c.assigned_to).filter(Boolean))] as string[]
  const { data: profiles } = assignedIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", assignedIds)
    : { data: [] }
  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.full_name]))

  const statusStyles: Record<string, string> = {
    in_use: "text-green-700 border-green-300 bg-green-50",
    spare: "text-blue-700 border-blue-300 bg-blue-50",
    in_repair: "text-amber-700 border-amber-300 bg-amber-50",
    retired: "text-gray-500",
  }

  return (
    <div>
      <PageHeader title="Computers" description="Device inventory">
        {canManage && <ComputerFormDialog />}
      </PageHeader>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Hostname</th>
              <th className="text-left px-4 py-3 font-medium">Device</th>
              <th className="text-left px-4 py-3 font-medium">Assigned to</th>
              <th className="text-left px-4 py-3 font-medium">Location</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {(computers ?? []).map((c) => (
              <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3">
                  <Link href={`/ims/computers/${c.id}`} className="font-medium hover:underline">{c.hostname}</Link>
                  {c.asset_tag && <div className="text-xs text-muted-foreground">Tag {c.asset_tag}</div>}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {c.device_type.replace(/_/g, " ")}
                  {(c.make || c.model) && <div className="text-xs">{[c.make, c.model].filter(Boolean).join(" ")}</div>}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{c.assigned_to ? profileMap[c.assigned_to] ?? "—" : "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.location ?? "—"}</td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className={`text-xs ${statusStyles[c.status] ?? ""}`}>
                    {c.status.replace(/_/g, " ")}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  {canManage && (
                    <div className="flex items-center justify-end gap-1">
                      <ComputerFormDialog computer={c} />
                      <DeleteComputerButton computerId={c.id} hostname={c.hostname} />
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!(computers?.length) && (
          <div className="text-center py-10 text-muted-foreground text-sm">No computers yet.</div>
        )}
      </div>
    </div>
  )
}
