"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { toast } from "sonner"

interface Company { id: string; name: string }
interface Branch { id: string; name: string; is_head_office: boolean }

const EMPTY = {
  full_name: "", email: "", company_id: "", branch_id: "",
  start_date: "", finish_date: "", pay_rate: "", charge_rate: "", currency: "AUD",
}

export function ProvisionContractorDialog({
  open, onOpenChange, companies, onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  companies: Company[]
  onCreated: () => void
}) {
  const [form, setForm] = useState({ ...EMPTY })
  const [branches, setBranches] = useState<Branch[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) setForm({ ...EMPTY })
  }, [open])

  useEffect(() => {
    if (!form.company_id) { setBranches([]); return }
    fetch(`/api/companies/${form.company_id}/branches`)
      .then((r) => r.json())
      .then((data) => setBranches(Array.isArray(data) ? data : []))
      .catch(() => setBranches([]))
  }, [form.company_id])

  function set(k: keyof typeof EMPTY, v: string) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  const valid = form.full_name && form.email && form.company_id && form.start_date

  async function handleSubmit() {
    if (!valid) return
    setSaving(true)
    try {
      const res = await fetch("/api/timesheets/contractors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: form.full_name,
          email: form.email,
          company_id: form.company_id,
          branch_id: form.branch_id || null,
          start_date: form.start_date,
          finish_date: form.finish_date || null,
          pay_rate: form.pay_rate || null,
          charge_rate: form.charge_rate || null,
          currency: form.currency,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(typeof body.error === "string" ? body.error : "Failed to provision contractor")
      }
      const created = await res.json()
      toast.success(
        created.email_sent === false
          ? `${form.full_name} provisioned — emails are paused, no invite sent`
          : `${form.full_name} provisioned — a set-password email has been sent`
      )
      onCreated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to provision contractor")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Provision contractor</DialogTitle></DialogHeader>
        <div className="space-y-3 py-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Full name *</Label>
              <Input value={form.full_name} onChange={(e) => set("full_name", e.target.value)} autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>Email (login) *</Label>
              <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Company *</Label>
            <Select value={form.company_id} onValueChange={(v) => { set("company_id", v); set("branch_id", "") }}>
              <SelectTrigger><SelectValue placeholder="Select a company" /></SelectTrigger>
              <SelectContent>
                {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {branches.length > 0 && (
            <div className="space-y-1.5">
              <Label>Branch</Label>
              <Select value={form.branch_id || "_none_"} onValueChange={(v) => set("branch_id", v === "_none_" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Not assigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none_">Not assigned</SelectItem>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}{b.is_head_office ? " (Head Office)" : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Start date *</Label>
              <Input type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Finish date</Label>
              <Input type="date" value={form.finish_date} onChange={(e) => set("finish_date", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Pay rate</Label>
              <Input type="number" step="0.01" value={form.pay_rate} onChange={(e) => set("pay_rate", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Charge rate</Label>
              <Input type="number" step="0.01" value={form.charge_rate} onChange={(e) => set("charge_rate", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Input value={form.currency} onChange={(e) => set("currency", e.target.value)} />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            A timesheets-portal login is created immediately and a set-password email is sent to this address.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!valid || saving}>{saving ? "Provisioning…" : "Provision"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
