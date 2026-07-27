"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Plus, Loader2 } from "lucide-react"
import { toast } from "sonner"

export function CreateUserGroupDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")

  function reset() {
    setName("")
    setDescription("")
  }

  async function handleCreate() {
    if (!name.trim()) { toast.error("Name is required"); return }
    setSaving(true)
    try {
      const res = await fetch("/api/admin/user-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description || undefined, permissionKeys: [] }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? "Failed to create group")
        return
      }
      const { id } = await res.json()
      toast.success("Group created")
      reset()
      setOpen(false)
      router.push(`/admin/settings/groups/${id}`)
    } catch {
      toast.error("Network error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) reset(); setOpen(next) }}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" />
          New Group
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Security Group</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Regulatory Consultants" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
          </div>
          <p className="text-xs text-muted-foreground">
            You&apos;ll set permissions and add members on the next screen.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Create
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
