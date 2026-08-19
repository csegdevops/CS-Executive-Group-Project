"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Plus, Pencil, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface WifiNetwork {
  id: string
  ssid: string
  location: string | null
  router_make: string | null
  router_model: string | null
  router_management_ip: string | null
  router_admin_username: string | null
  wifi_password_vault_reference: string | null
  router_admin_vault_reference: string | null
  last_rotated_at: string | null
  notes: string | null
}

export function WifiFormDialog({ network }: { network?: WifiNetwork }) {
  const router = useRouter()
  const editMode = !!network
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    ssid: network?.ssid ?? "",
    location: network?.location ?? "",
    router_make: network?.router_make ?? "",
    router_model: network?.router_model ?? "",
    router_management_ip: network?.router_management_ip ?? "",
    router_admin_username: network?.router_admin_username ?? "",
    wifi_password_vault_reference: network?.wifi_password_vault_reference ?? "",
    router_admin_vault_reference: network?.router_admin_vault_reference ?? "",
    last_rotated_at: network?.last_rotated_at ?? "",
    notes: network?.notes ?? "",
  })

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.ssid.trim()) return
    setLoading(true)
    try {
      const body = Object.fromEntries(
        Object.entries(form).map(([k, v]) => [k, v.trim() || undefined])
      )
      const res = await fetch(editMode ? `/api/ims/wifi/${network!.id}` : "/api/ims/wifi", {
        method: editMode ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? "Failed to save network")
        return
      }
      toast.success(editMode ? "Network updated" : "Network created")
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
          <Button size="sm"><Plus className="h-4 w-4 mr-1" />New Network</Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editMode ? "Edit Network" : "New Network"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>SSID *</Label>
              <Input value={form.ssid} onChange={(e) => set("ssid", e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Location</Label>
              <Input value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="Sydney office" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Router make</Label>
              <Input value={form.router_make} onChange={(e) => set("router_make", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Router model</Label>
              <Input value={form.router_model} onChange={(e) => set("router_model", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Management IP</Label>
              <Input value={form.router_management_ip} onChange={(e) => set("router_management_ip", e.target.value)} placeholder="192.168.1.1" />
            </div>
            <div className="space-y-1.5">
              <Label>Router admin username</Label>
              <Input value={form.router_admin_username} onChange={(e) => set("router_admin_username", e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Wifi password — vault reference</Label>
            <Input
              value={form.wifi_password_vault_reference}
              onChange={(e) => set("wifi_password_vault_reference", e.target.value)}
              placeholder="Bitwarden — IT Vault / Office Wifi"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Router admin password — vault reference</Label>
            <Input
              value={form.router_admin_vault_reference}
              onChange={(e) => set("router_admin_vault_reference", e.target.value)}
              placeholder="Bitwarden — IT Vault / Office Router Admin"
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
            <Button type="submit" disabled={loading || !form.ssid.trim()}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editMode ? "Save" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
