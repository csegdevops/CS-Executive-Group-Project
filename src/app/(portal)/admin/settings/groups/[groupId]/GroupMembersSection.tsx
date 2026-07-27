"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { UserPlus, X, Loader2, Search } from "lucide-react"
import { toast } from "sonner"

interface MemberUser {
  id: string
  name: string
  email: string
}

function initials(name: string) {
  const parts = name.split(" ").filter(Boolean)
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?"
}

export function GroupMembersSection({
  groupId,
  members,
  candidates,
  locked,
}: {
  groupId: string
  members: MemberUser[]
  candidates: MemberUser[]
  locked: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [pendingIds, setPendingIds] = useState<string[]>([])
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const availableCandidates = candidates.filter((c) => {
    const q = query.toLowerCase()
    return !q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
  })

  async function handleRemove(userId: string) {
    setRemovingId(userId)
    try {
      const res = await fetch(`/api/users/${userId}/groups`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ group_id: groupId }),
      })
      if (!res.ok) { toast.error("Failed to remove member"); return }
      toast.success("Member removed")
      router.refresh()
    } catch {
      toast.error("Network error")
    } finally {
      setRemovingId(null)
    }
  }

  function togglePending(userId: string) {
    setPendingIds((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]))
  }

  async function handleAdd() {
    if (pendingIds.length === 0) { setOpen(false); return }
    setAdding(true)
    try {
      const results = await Promise.all(
        pendingIds.map((userId) =>
          fetch(`/api/users/${userId}/groups`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ group_id: groupId }),
          })
        )
      )
      if (results.some((r) => !r.ok)) {
        toast.error("Some members could not be added")
      } else {
        toast.success("Members added")
      }
      setPendingIds([])
      setQuery("")
      setOpen(false)
      router.refresh()
    } catch {
      toast.error("Network error")
    } finally {
      setAdding(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Members ({members.length})
        </h2>
        {!locked && (
          <Dialog
            open={open}
            onOpenChange={(next) => { setOpen(next); if (!next) { setPendingIds([]); setQuery("") } }}
          >
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1">
                <UserPlus className="h-3.5 w-3.5" />
                Add members
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add members</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 mt-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search users..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <div className="max-h-72 overflow-y-auto space-y-1">
                  {availableCandidates.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-6">No matching users.</p>
                  )}
                  {availableCandidates.map((u) => (
                    <label
                      key={u.id}
                      className="flex items-center gap-2 py-1.5 px-1 rounded hover:bg-muted/50 cursor-pointer text-sm"
                    >
                      <Checkbox checked={pendingIds.includes(u.id)} onCheckedChange={() => togglePending(u.id)} />
                      <span className="font-medium">{u.name}</span>
                      <span className="text-muted-foreground text-xs">{u.email}</span>
                    </label>
                  ))}
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={adding}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleAdd} disabled={adding || pendingIds.length === 0}>
                    {adding && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                    Add{pendingIds.length > 0 ? ` (${pendingIds.length})` : ""}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="border rounded-lg divide-y">
        {members.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">No members yet.</p>
        )}
        {members.map((m) => (
          <div key={m.id} className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-xs">{initials(m.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{m.name}</p>
                <p className="text-xs text-muted-foreground truncate">{m.email}</p>
              </div>
            </div>
            {!locked && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                disabled={removingId === m.id}
                onClick={() => handleRemove(m.id)}
              >
                {removingId === m.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
