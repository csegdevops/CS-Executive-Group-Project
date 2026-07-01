"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Plus } from "lucide-react"
import { toast } from "sonner"

interface Contact {
  id: string
  first_name: string
  last_name: string
}

interface Profile {
  id: string
  full_name: string | null
}

interface Props {
  companyId: string
  companyName: string
  contacts: Contact[]
  profiles: Profile[]
}

// Radix SelectItem rejects empty string values — use a sentinel instead
const NONE = "_none_"
const toNull = (v: string) => (v === NONE || v === "") ? null : v

export function NewOpportunityDialog({ companyId, companyName, contacts, profiles }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    title:               "",
    stage:               "lead",
    value:               "",
    module:              NONE,
    contact_id:          NONE,
    assigned_to:         NONE,
    expected_close_date: "",
    notes:               "",
  })

  function set(k: keyof typeof form, v: string) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function handleCreate() {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        company_id: companyId,
        title:      form.title.trim(),
        stage:      form.stage,
        notes:      form.notes.trim() || null,
        contact_id:          toNull(form.contact_id),
        assigned_to:         toNull(form.assigned_to),
        module:              toNull(form.module),
        expected_close_date: form.expected_close_date || null,
      }
      if (form.value) body.value = parseFloat(form.value)

      const res = await fetch("/api/crm/opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) { toast.error("Failed to create opportunity"); return }
      toast.success("Opportunity created")
      setOpen(false)
      setForm({ title: "", stage: "lead", value: "", module: NONE, contact_id: NONE, assigned_to: NONE, expected_close_date: "", notes: "" })
      router.refresh()
    } finally { setSaving(false) }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5">
        <Plus className="h-4 w-4" />New Opportunity
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New opportunity — {companyName}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input
                value={form.title}
                onChange={e => set("title", e.target.value)}
                placeholder="e.g. AICIS assessment for 3 new chemicals"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Stage</Label>
                <Select value={form.stage} onValueChange={v => set("stage", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lead">Lead</SelectItem>
                    <SelectItem value="qualified">Qualified</SelectItem>
                    <SelectItem value="proposal">Proposal</SelectItem>
                    <SelectItem value="negotiation">Negotiation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Module</Label>
                <Select value={form.module} onValueChange={v => set("module", v)}>
                  <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Any</SelectItem>
                    <SelectItem value="regulatory">Regulatory</SelectItem>
                    <SelectItem value="recruitment">Recruitment</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Value (AUD)</Label>
                <Input
                  type="number"
                  value={form.value}
                  onChange={e => set("value", e.target.value)}
                  placeholder="25000"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Expected close</Label>
                <Input
                  type="date"
                  value={form.expected_close_date}
                  onChange={e => set("expected_close_date", e.target.value)}
                />
              </div>
            </div>

            {contacts.length > 0 && (
              <div className="space-y-1.5">
                <Label>Contact</Label>
                <Select value={form.contact_id} onValueChange={v => set("contact_id", v)}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    {contacts.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {profiles.length > 0 && (
              <div className="space-y-1.5">
                <Label>Assigned to</Label>
                <Select value={form.assigned_to} onValueChange={v => set("assigned_to", v)}>
                  <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Unassigned</SelectItem>
                    {profiles.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.full_name ?? p.id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <textarea
                rows={2}
                value={form.notes}
                onChange={e => set("notes", e.target.value)}
                placeholder="Context, background…"
                className="w-full text-sm rounded-md border border-border bg-background px-3 py-2 resize-y focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!form.title.trim() || saving}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
