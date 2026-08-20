"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Plus, Loader2, Lock } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

export function CreateUserDialog({
  allGroups = [],
}: {
  allGroups?: { id: string; name: string; is_locked: boolean }[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", role: "user" })
  const [groupIds, setGroupIds] = useState<string[]>([])

  function toggleGroup(groupId: string) {
    setGroupIds((prev) => prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const { first_name, last_name, ...rest } = form
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...rest, full_name: `${first_name.trim()} ${last_name.trim()}`.trim() }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? "Failed to invite user")
        return
      }
      const created = await res.json()

      // Super admins bypass the group/permission system entirely, so group
      // selection is only meaningful — and only shown — for regular users.
      let groupFailures = 0
      if (form.role !== "super_admin" && groupIds.length > 0) {
        const results = await Promise.all(groupIds.map((groupId) =>
          fetch(`/api/users/${created.id}/groups`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ group_id: groupId }),
          })
        ))
        groupFailures = results.filter((r) => !r.ok).length
      }

      const inviteMessage = created.email_sent === false
        ? "User created — emails are paused, no invite was sent"
        : "Invite sent — they'll get an email to set their password"
      toast.success(groupFailures > 0 ? `${inviteMessage} (failed to assign ${groupFailures} group(s) — try Manage Groups)` : inviteMessage)

      setOpen(false)
      setForm({ first_name: "", last_name: "", email: "", role: "user" })
      setGroupIds([])
      router.refresh()
    } catch {
      toast.error("Network error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Invite User
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite User</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>First Name</Label>
              <Input
                value={form.first_name}
                onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Last Name</Label>
              <Input
                value={form.last_name}
                onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              required
            />
          </div>
          <p className="text-xs text-muted-foreground">
            They&apos;ll get an email with a link to set their own password — no temporary password to share.
          </p>
          <div className="space-y-2">
            <Label>Role</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            >
              <option value="user">User</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>
          {form.role !== "super_admin" && (
            <div className="space-y-2">
              <Label>Groups</Label>
              <p className="text-xs text-muted-foreground">
                Determines which modules they can access and at what level — leave empty to grant no access yet.
              </p>
              {allGroups.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">No groups exist yet. Create one first if you want to grant access now.</p>
              ) : (
                <div className="border rounded-md divide-y max-h-40 overflow-y-auto">
                  {allGroups.map((group) => (
                    <label
                      key={group.id}
                      className={cn(
                        "flex items-center justify-between gap-4 px-3 py-2",
                        group.is_locked ? "cursor-not-allowed" : "cursor-pointer"
                      )}
                      title={group.is_locked ? "Managed automatically via role, not group assignment" : undefined}
                    >
                      <span className="text-sm flex items-center gap-1.5">
                        {group.name}
                        {group.is_locked && <Lock className="h-3 w-3 text-muted-foreground" />}
                      </span>
                      <input
                        type="checkbox"
                        checked={groupIds.includes(group.id)}
                        disabled={group.is_locked}
                        onChange={() => toggleGroup(group.id)}
                        className="rounded"
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Send Invite
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
