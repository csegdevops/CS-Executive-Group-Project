import { Badge } from "@/components/ui/badge"

export function GroupBadges({
  groups,
  isSuperAdmin,
}: {
  groups: { id: string; name: string }[]
  isSuperAdmin: boolean
}) {
  if (isSuperAdmin) {
    return <Badge variant="secondary" className="text-xs">Full Access</Badge>
  }

  if (groups.length === 0) {
    return <span className="text-xs text-muted-foreground">No groups</span>
  }

  return (
    <div className="flex flex-wrap gap-1">
      {groups.map((g) => (
        <Badge key={g.id} variant="outline" className="text-xs">
          {g.name}
        </Badge>
      ))}
    </div>
  )
}
