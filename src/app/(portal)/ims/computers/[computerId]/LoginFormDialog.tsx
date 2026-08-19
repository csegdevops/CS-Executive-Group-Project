"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Plus, Pencil, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface Profile { id: string; full_name: string | null }

interface ComputerLogin {
  id: string
  login_username: string
  user_id: string | null
  login_type: string
  vault_reference: string | null
  last_rotated_at: string | null
  notes: string | null
}

const LOGIN_TYPES = ["local", "domain", "microsoft_account", "other"]

export function LoginFormDialog({ computerId, login }: { computerId: string; login?: ComputerLogin }) {
  const router = useRouter()
  const editMode = !!login
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [form, setForm] = useState({
    login_username: login?.login_username ?? "",
    user_id: login?.user_id ?? "",
    login_type: login?.login_type ?? "local",
    vault_reference: login?.vault_reference ?? "",
    last_rotated_at: login?.last_rotated_at ?? "",
    notes: login?.notes ?? "",
  })

  useEffect(() => {
    if (!open) return
    fetch("/api/users")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setProfiles(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [open])

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.login_username.trim()) return
    setLoading(true)
    try {
      const body = {
        login_username: form.login_username.trim(),
        user_id: form.user_id || undefined,
        login_type: form.login_type,
        vault_reference: form.vault_reference.trim() || undefined,
        last_rotated_at: form.last_rotated_at || undefined,
        notes: form.notes.trim() || undefined,
      }
      const url = editMode
        ? `/api/ims/computers/${computerId}/logins/${login!.id}`
        : `/api/ims/computers/${computerId}/logins`
      const res = await fetch(url, {
        method: editMode ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? "Failed to save login")
        return
      }
      toast.success(editMode ? "Login updated" : "Login added")
      setOpen(false)
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
        {editMode ? (
          <Button variant="ghost" size="sm" className="gap-1">
            <Pencil className="h-3.5 w-3.5" />Edit
          </Button>
        ) : (
          <Button size="sm"><Plus className="h-4 w-4 mr-1" />Add Login</Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editMode ? "Edit Login" : "Add Login"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label>Username *</Label>
            <Input value={form.login_username} onChange={(e) => set("login_username", e.target.value)} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Login type</Label>
              <Select value={form.login_type} onValueChange={(v) => set("login_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LOGIN_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>User</Label>
              <Select value={form.user_id || "__none__"} onValueChange={(v) => set("user_id", v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Shared / none" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Shared / none</SelectItem>
                  {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name ?? p.id}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Vault reference</Label>
            <Input
              value={form.vault_reference}
              onChange={(e) => set("vault_reference", e.target.value)}
              placeholder="Bitwarden — IT Vault / IT-LAPTOP-042"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Last rotated</Label>
            <Input type="date" value={form.last_rotated_at} onChange={(e) => set("last_rotated_at", e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={2}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || !form.login_username.trim()}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editMode ? "Save" : "Add"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
