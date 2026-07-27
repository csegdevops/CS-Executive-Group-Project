"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Pencil, Lock, Loader2, Check, X } from "lucide-react"
import { toast } from "sonner"
import { DeleteUserGroupButton } from "../DeleteUserGroupButton"

export function GroupDetailHeader({
  groupId,
  name: initialName,
  description: initialDescription,
  memberCount,
  permissionCount,
  locked,
}: {
  groupId: string
  name: string
  description: string | null
  memberCount: number
  permissionCount: number
  locked: boolean
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState(initialDescription ?? "")
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!name.trim()) { toast.error("Name is required"); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/user-groups/${groupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? "Failed to update group")
        return
      }
      toast.success("Group updated")
      setEditing(false)
      router.refresh()
    } catch {
      toast.error("Network error")
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <div className="space-y-2 max-w-md mb-6">
        <Input value={name} onChange={(e) => setName(e.target.value)} className="text-lg font-semibold h-9" />
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          className="text-sm h-8"
        />
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Save
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={saving}
            onClick={() => { setEditing(false); setName(initialName); setDescription(initialDescription ?? "") }}
          >
            <X className="h-3.5 w-3.5" />
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{initialName}</h1>
          {locked ? (
            <Badge variant="outline" className="text-xs gap-1 text-muted-foreground">
              <Lock className="h-3 w-3" />
              Locked
            </Badge>
          ) : (
            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        {initialDescription && <p className="text-sm text-muted-foreground mt-1">{initialDescription}</p>}
        <p className="text-sm text-muted-foreground mt-1">
          {memberCount} {memberCount === 1 ? "member" : "members"} · {permissionCount} {permissionCount === 1 ? "permission" : "permissions"}
        </p>
      </div>
      {!locked && (
        <DeleteUserGroupButton groupId={groupId} groupName={initialName} redirectTo="/admin/settings/groups" />
      )}
    </div>
  )
}
