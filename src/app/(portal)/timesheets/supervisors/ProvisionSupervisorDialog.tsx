"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { toast } from "sonner"

interface Company { id: string; name: string }
interface Contact { id: string; first_name: string; last_name: string; email: string | null }

const EMPTY = { full_name: "", email: "", company_id: "", contact_id: "" }

export function ProvisionSupervisorDialog({
  open, onOpenChange, companies, onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  companies: Company[]
  onCreated: () => void
}) {
  const [form, setForm] = useState({ ...EMPTY })
  const [mode, setMode] = useState<"new" | "existing">("new")
  const [contacts, setContacts] = useState<Contact[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) { setForm({ ...EMPTY }); setMode("new") }
  }, [open])

  useEffect(() => {
    if (!form.company_id) { setContacts([]); return }
    fetch(`/api/companies/${form.company_id}/contacts`)
      .then((r) => r.json())
      .then((data) => setContacts(Array.isArray(data) ? data.filter((c: { email: string | null }) => c.email) : []))
      .catch(() => setContacts([]))
  }, [form.company_id])

  function set(k: keyof typeof EMPTY, v: string) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  function selectExistingContact(contactId: string) {
    const contact = contacts.find((c) => c.id === contactId)
    set("contact_id", contactId)
    if (contact) {
      set("full_name", `${contact.first_name} ${contact.last_name}`.trim())
      set("email", contact.email ?? "")
    }
  }

  const valid = form.full_name && form.email && form.company_id

  async function handleSubmit() {
    if (!valid) return
    setSaving(true)
    try {
      const res = await fetch("/api/timesheets/supervisors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: form.full_name,
          email: form.email,
          company_id: form.company_id,
          contact_id: mode === "existing" && form.contact_id ? form.contact_id : null,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(typeof body.error === "string" ? body.error : "Failed to provision supervisor")
      }
      const created = await res.json()
      toast.success(
        created.email_sent === false
          ? `${form.full_name} provisioned — emails are paused, no invite sent`
          : `${form.full_name} provisioned — a set-password email has been sent`
      )
      onCreated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to provision supervisor")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Provision supervisor</DialogTitle></DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label>Company *</Label>
            <Select value={form.company_id} onValueChange={(v) => { set("company_id", v); set("contact_id", "") }}>
              <SelectTrigger><SelectValue placeholder="Select a company" /></SelectTrigger>
              <SelectContent>
                {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {form.company_id && contacts.length > 0 && (
            <div className="flex gap-1 text-xs border rounded-md p-1 w-fit">
              <button type="button" onClick={() => setMode("new")} className={`px-2 py-1 rounded ${mode === "new" ? "bg-muted font-medium" : "text-muted-foreground"}`}>New contact</button>
              <button type="button" onClick={() => setMode("existing")} className={`px-2 py-1 rounded ${mode === "existing" ? "bg-muted font-medium" : "text-muted-foreground"}`}>Existing contact</button>
            </div>
          )}

          {mode === "existing" && contacts.length > 0 ? (
            <div className="space-y-1.5">
              <Label>Contact</Label>
              <Select value={form.contact_id} onValueChange={selectExistingContact}>
                <SelectTrigger><SelectValue placeholder="Select a contact" /></SelectTrigger>
                <SelectContent>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name} ({c.email})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
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
          )}

          <p className="text-xs text-muted-foreground">
            The contact record is tagged &quot;Supervisor&quot; and a timesheets-portal login is created with a set-password email sent to this address.
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
