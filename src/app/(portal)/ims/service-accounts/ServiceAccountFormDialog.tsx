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

interface ServiceAccount {
  id: string
  service_name: string
  service_url: string | null
  account_username: string | null
  assigned_to: string | null
  vault_reference: string | null
  last_rotated_at: string | null
  notes: string | null
}

export function ServiceAccountFormDialog({ account }: { account?: ServiceAccount }) {
  const router = useRouter()
  const editMode = !!account
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [form, setForm] = useState({
    service_name: account?.service_name ?? "",
    service_url: account?.service_url ?? "",
    account_username: account?.account_username ?? "",
    assigned_to: account?.assigned_to ?? "",
    vault_reference: account?.vault_reference ?? "",
    last_rotated_at: account?.last_rotated_at ?? "",
    notes: account?.notes ?? "",
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
    if (!form.service_name.trim()) return
    setLoading(true)
    try {
      const body = {
        service_name: form.service_name.trim(),
        service_url: form.service_url.trim() || undefined,
        account_username: form.account_username.trim() || undefined,
        assigned_to: form.assigned_to || undefined,
        vault_reference: form.vault_reference.trim() || undefined,
        last_rotated_at: form.last_rotated_at || undefined,
        notes: form.notes.trim() || undefined,
      }
      const res = await fetch(editMode ? `/api/ims/service-accounts/${account!.id}` : "/api/ims/service-accounts", {
        method: editMode ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? "Failed to save service account")
        return
      }
      toast.success(editMode ? "Service account updated" : "Service account created")
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
          <Button size="sm"><Plus className="h-4 w-4 mr-1" />New Service Account</Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editMode ? "Edit Service Account" : "New Service Account"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label>Service name *</Label>
            <Input value={form.service_name} onChange={(e) => set("service_name", e.target.value)} placeholder="AWS, Xero, PubChem…" required />
          </div>

          <div className="space-y-1.5">
            <Label>Service URL</Label>
            <Input value={form.service_url} onChange={(e) => set("service_url", e.target.value)} placeholder="https://…" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Account username</Label>
              <Input value={form.account_username} onChange={(e) => set("account_username", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Owner</Label>
              <Select value={form.assigned_to || "__none__"} onValueChange={(v) => set("assigned_to", v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Shared / team" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Shared / team</SelectItem>
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
              placeholder="Bitwarden — IT Vault / AWS Root"
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
            <Button type="submit" disabled={loading || !form.service_name.trim()}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editMode ? "Save" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
