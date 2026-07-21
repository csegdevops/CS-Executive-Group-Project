"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Pencil, Loader2, KeyRound } from "lucide-react"
import { toast } from "sonner"

export function EditUserDialog({
  userId,
  email,
  initialFullName,
  initialRole,
  isSelf,
}: {
  userId: string
  email: string
  initialFullName: string
  initialRole: "super_admin" | "user"
  isSelf: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [fullName, setFullName] = useState(initialFullName)
  const [role, setRole] = useState<"super_admin" | "user">(initialRole)
  const [saving, setSaving] = useState(false)
  const [sendingReset, setSendingReset] = useState(false)

  async function handleSave() {
    if (!fullName.trim()) { toast.error("Name is required"); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName.trim(), role }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? "Failed to update user")
        return
      }
      toast.success("User updated")
      setOpen(false)
      router.refresh()
    } catch {
      toast.error("Network error")
    } finally {
      setSaving(false)
    }
  }

  async function handleSendReset() {
    setSendingReset(true)
    try {
      const res = await fetch(`/api/users/${userId}/reset-password`, { method: "POST" })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? "Failed to send reset email")
        return
      }
      toast.success(`Password reset email sent to ${email}`)
    } catch {
      toast.error("Network error")
    } finally {
      setSendingReset(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <Pencil className="h-3 w-3" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label>Full Name</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={email} disabled className="text-muted-foreground" />
          </div>

          <div className="space-y-2">
            <Label>Role</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={role}
              disabled={isSelf}
              onChange={(e) => setRole(e.target.value as "super_admin" | "user")}
            >
              <option value="user">User</option>
              <option value="super_admin">Super Admin</option>
            </select>
            {isSelf && (
              <p className="text-xs text-muted-foreground">You cannot change your own role.</p>
            )}
          </div>

          <div className="pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 w-full"
              disabled={sendingReset}
              onClick={handleSendReset}
            >
              {sendingReset ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
              Send Password Reset Email
            </Button>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
