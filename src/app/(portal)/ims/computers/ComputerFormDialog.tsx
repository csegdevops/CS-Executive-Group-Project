"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Plus, Pencil, Loader2, ExternalLink } from "lucide-react"
import { toast } from "sonner"

interface Profile { id: string; full_name: string | null }

interface Computer {
  id: string
  hostname: string
  asset_tag: string | null
  device_type: string
  make: string | null
  model: string | null
  serial_number: string | null
  service_tag: string | null
  assigned_to: string | null
  location: string | null
  status: string
  notes: string | null
}

const DEVICE_TYPES = ["laptop", "desktop", "server", "printer", "network_device", "mobile", "other"]
const STATUSES = ["in_use", "spare", "in_repair", "retired"]
const LOCATIONS = ["Melbourne Office", "Sydney", "Brisbane", "Canberra"]

export function ComputerFormDialog({ computer }: { computer?: Computer }) {
  const router = useRouter()
  const editMode = !!computer
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [form, setForm] = useState({
    hostname: computer?.hostname ?? "",
    asset_tag: computer?.asset_tag ?? "",
    device_type: computer?.device_type ?? "laptop",
    make: computer?.make ?? "",
    model: computer?.model ?? "",
    serial_number: computer?.serial_number ?? "",
    service_tag: computer?.service_tag ?? "",
    assigned_to: computer?.assigned_to ?? "",
    location: computer?.location ?? "",
    status: computer?.status ?? "in_use",
    notes: computer?.notes ?? "",
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

  // A computer that's actively in someone's hands (in use) or being worked on
  // (in repair) needs a named owner; spares and retired stock don't.
  const needsOwner = form.status === "in_use" || form.status === "in_repair"

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.hostname.trim()) return
    if (needsOwner && !form.assigned_to) return
    setLoading(true)
    try {
      const body = {
        hostname: form.hostname.trim(),
        asset_tag: form.asset_tag.trim() || undefined,
        device_type: form.device_type,
        make: form.make.trim() || undefined,
        model: form.model.trim() || undefined,
        serial_number: form.serial_number.trim() || undefined,
        service_tag: form.service_tag.trim() || undefined,
        assigned_to: form.assigned_to || undefined,
        location: form.location || undefined,
        status: form.status,
        notes: form.notes.trim() || undefined,
      }
      const res = await fetch(editMode ? `/api/ims/computers/${computer!.id}` : "/api/ims/computers", {
        method: editMode ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? "Failed to save computer")
        return
      }
      toast.success(editMode ? "Computer updated" : "Computer created")
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
          <Button size="sm"><Plus className="h-4 w-4 mr-1" />New Computer</Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editMode ? "Edit Computer" : "New Computer"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label>Hostname *</Label>
            <Input value={form.hostname} onChange={(e) => set("hostname", e.target.value)} placeholder="IT-LAPTOP-042" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Asset tag</Label>
              <Input
                value={form.asset_tag}
                onChange={(e) => set("asset_tag", e.target.value)}
                placeholder={editMode ? undefined : "Leave blank to auto-assign CSEG-CL#"}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Device type</Label>
              <Select value={form.device_type} onValueChange={(v) => set("device_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DEVICE_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Make</Label>
              <Input value={form.make} onChange={(e) => set("make", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Model</Label>
              <Input value={form.model} onChange={(e) => set("model", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Serial number</Label>
              <Input value={form.serial_number} onChange={(e) => set("serial_number", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Dell service tag</Label>
              <Input value={form.service_tag} onChange={(e) => set("service_tag", e.target.value)} placeholder="e.g. 7X8K9L2" />
            </div>
          </div>

          {form.service_tag.trim() && (
            <a
              href="https://www.dell.com/support/home/en-au"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground -mt-2"
            >
              <ExternalLink className="h-3 w-3" />
              Check warranty on Dell Support using this service tag
            </a>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Assigned to{needsOwner ? " *" : ""}</Label>
              <Select value={form.assigned_to || "__none__"} onValueChange={(v) => set("assigned_to", v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  {!needsOwner && <SelectItem value="__none__">Unassigned</SelectItem>}
                  {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name ?? p.id}</SelectItem>)}
                </SelectContent>
              </Select>
              {needsOwner && !form.assigned_to && (
                <p className="text-xs text-destructive">Required while status is &quot;in use&quot; or &quot;in repair&quot;</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Location</Label>
            <Select value={form.location || "__none__"} onValueChange={(v) => set("location", v === "__none__" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Select a location…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Unspecified</SelectItem>
                {LOCATIONS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
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
            <Button type="submit" disabled={loading || !form.hostname.trim() || (needsOwner && !form.assigned_to)}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editMode ? "Save" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
