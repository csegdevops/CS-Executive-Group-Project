import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Lock } from "lucide-react"
import { EditUserGroupDialog } from "./EditUserGroupDialog"
import { DeleteUserGroupButton } from "./DeleteUserGroupButton"
import { MODULE_LABELS, shortPermissionLabel } from "@/lib/permissions"
import type { Module } from "@/types/database"
import type { UserGroupWithGrants } from "./page"

function moduleOf(key: string): Module | null {
  const [prefix] = key.split(".")
  return prefix === "regulatory" || prefix === "recruitment" || prefix === "crm" ? prefix : null
}

export function GroupCard({ group }: { group: UserGroupWithGrants }) {
  const grouped: Partial<Record<Module, string[]>> = {}
  const shared: string[] = []
  for (const key of group.permissionKeys) {
    const mod = moduleOf(key)
    if (mod) (grouped[mod] ??= []).push(key)
    else shared.push(key)
  }

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium">{group.name}</p>
            {group.description && (
              <p className="text-xs text-muted-foreground mt-0.5">{group.description}</p>
            )}
            {group.is_locked ? (
              <p className="text-xs text-muted-foreground mt-2">Grants full access via role — not via permissions</p>
            ) : group.permissionKeys.length === 0 ? (
              <p className="text-xs text-muted-foreground mt-2">No permissions granted</p>
            ) : (
              <div className="space-y-1.5 mt-2">
                {(Object.keys(grouped) as Module[]).map((mod) => (
                  <div key={mod} className="flex flex-wrap items-center gap-1">
                    <span className="text-xs font-medium text-muted-foreground mr-1">{MODULE_LABELS[mod]}:</span>
                    {grouped[mod]!.map((key) => (
                      <Badge key={key} variant="outline" className="text-xs">
                        {shortPermissionLabel(key)}
                      </Badge>
                    ))}
                  </div>
                ))}
                {shared.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-xs font-medium text-muted-foreground mr-1">Shared:</span>
                    {shared.map((key) => (
                      <Badge key={key} variant="outline" className="text-xs">
                        {shortPermissionLabel(key)}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              {group.memberCount} {group.memberCount === 1 ? "member" : "members"}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {group.is_locked ? (
              <Badge variant="outline" className="text-xs gap-1 text-muted-foreground">
                <Lock className="h-3 w-3" />
                Locked
              </Badge>
            ) : (
              <>
                <EditUserGroupDialog group={group} />
                <DeleteUserGroupButton groupId={group.id} groupName={group.name} />
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
