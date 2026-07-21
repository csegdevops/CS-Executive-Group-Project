"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Users2, Loader2, Lock } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

export function ManageUserGroupsDialog({
  userId,
  isSuperAdmin,
  allGroups,
  initialGroupIds,
}: {
  userId: string
  isSuperAdmin: boolean
  allGroups: { id: string; name: string; is_locked: boolean }[]
  initialGroupIds: string[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [groupIds, setGroupIds] = useState<string[]>(initialGroupIds)
  const [loading, setLoading] = useState<string | null>(null)

  if (isSuperAdmin) {
    return <Badge variant="secondary" className="text-xs">Full Access</Badge>
  }

  async function toggle(groupId: string) {
    const isMember = groupIds.includes(groupId)
    setLoading(groupId)
    try {
      const res = await fetch(`/api/users/${userId}/groups`, {
        method: isMember ? "DELETE" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ group_id: groupId }),
      })
      if (!res.ok) { toast.error("Failed to update group membership"); return }
      setGroupIds((prev) => isMember ? prev.filter((id) => id !== groupId) : [...prev, groupId])
      toast.success("Groups updated")
      router.refresh()
    } catch {
      toast.error("Network error")
    } finally {
      setLoading(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <Users2 className="h-3 w-3" />
          Groups
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>User Groups</DialogTitle>
        </DialogHeader>
        <div className="space-y-1 mt-2">
          {allGroups.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No groups exist yet. Create one from Platform Settings.
            </p>
          )}
          {allGroups.map((group) => {
            const checked = groupIds.includes(group.id)
            const isLoading = loading === group.id
            return (
              <label
                key={group.id}
                className={cn(
                  "flex items-center justify-between gap-4 py-2 border-b last:border-0",
                  group.is_locked ? "cursor-not-allowed" : "cursor-pointer"
                )}
                title={group.is_locked ? "Managed automatically via user role — see Edit User" : undefined}
              >
                <span className="text-sm font-medium flex items-center gap-1.5">
                  {group.name}
                  {group.is_locked && <Lock className="h-3 w-3 text-muted-foreground" />}
                </span>
                <div className="flex items-center gap-2">
                  {isLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={isLoading || group.is_locked}
                    onChange={() => toggle(group.id)}
                    className="rounded"
                  />
                </div>
              </label>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
