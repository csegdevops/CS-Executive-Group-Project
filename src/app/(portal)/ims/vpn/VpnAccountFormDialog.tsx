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

interface VpnAccount {
  id: string
  user_id: string
  vpn_provider: string
  vpn_username: string
  vault_reference: string | null
  last_rotated_at: string | null
  notes: string | null
}

export function VpnAccountFormDialog({ account }: { account?: VpnAccount }) {
  const router = useRouter()
  const editMode = !!account
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [form, setForm] = useState({
    user_id: account?.user_id ?? "",
    vpn_provider: account?.vpn_provider ?? "default",
    vpn_username: account?.vpn_username ?? "",
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
    if (!editMode && !form.user_id) return
    if (!form.vpn_username.trim()) return
    setLoading(true)
    try {
      const body: Record<string, string | undefined> = {
        vpn_provider: form.vpn_provider.trim() || undefined,
        vpn_username: form.vpn_username.trim(),
        vault_reference: form.vault_reference.trim() || undefined,
        last_rotated_at: form.last_rotated_at || undefined,
        notes: form.notes.trim() || undefined,
      }
      if (!editMode) body.user_id = form.user_id
      const res = await fetch(editMode ? `/api/ims/vpn/${account!.id}` : "/api/ims/vpn", {
        method: editMode ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? "Failed to save VPN account")
        return
      }
      toast.success(editMode ? "VPN account updated" : "VPN account created")
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
          <Button size="sm"><Plus className="h-4 w-4 mr-1" />New VPN Account</Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editMode ? "Edit VPN Account" : "New VPN Account"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {!editMode && (
            <div className="space-y-1.5">
              <Label>User *</Label>
              <Select value={form.user_id} onValueChange={(v) => set("user_id", v)}>
                <SelectTrigger><SelectValue placeholder="Select a user…" /></SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name ?? p.id}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>VPN provider</Label>
              <Input value={form.vpn_provider} onChange={(e) => set("vpn_provider", e.target.value)} placeholder="default" />
            </div>
            <div className="space-y-1.5">
              <Label>VPN username *</Label>
              <Input value={form.vpn_username} onChange={(e) => set("vpn_username", e.target.value)} required />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Vault reference</Label>
            <Input
              value={form.vault_reference}
              onChange={(e) => set("vault_reference", e.target.value)}
              placeholder="Bitwarden — IT Vault / VPN"
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
            <Button type="submit" disabled={loading || (!editMode && !form.user_id) || !form.vpn_username.trim()}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editMode ? "Save" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
