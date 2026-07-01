"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Plus, Star, Pencil, Trash2, Mail, Phone, MapPin } from "lucide-react"
import { toast } from "sonner"

interface Branch {
  id: string
  name: string
  is_head_office: boolean
}

interface Contact {
  id: string
  company_id: string
  branch_id: string | null
  first_name: string
  last_name: string
  title: string | null
  department: string | null
  email: string | null
  phone: string | null
  is_primary: boolean
  notes: string | null
  is_active: boolean
  is_crm_contact: boolean
  is_regulatory_contact: boolean
  is_recruitment_contact: boolean
}

interface Props {
  companyId: string
  initialContacts: Contact[]
  branches?: Branch[]
}

interface FormShape {
  first_name: string
  last_name: string
  title: string | null
  department: string | null
  email: string | null
  phone: string | null
  is_primary: boolean
  notes: string | null
  branch_id: string | null
  is_crm_contact: boolean
  is_regulatory_contact: boolean
  is_recruitment_contact: boolean
}

const EMPTY: FormShape = {
  first_name: "", last_name: "", title: null, department: null,
  email: null, phone: null, is_primary: false, notes: null,
  branch_id: null,
  is_crm_contact: true, is_regulatory_contact: false, is_recruitment_contact: false,
}

const MODULE_BADGE: Record<string, string> = {
  crm:         "bg-blue-50  text-blue-700  border-blue-200",
  regulatory:  "bg-green-50 text-green-700 border-green-200",
  recruitment: "bg-purple-50 text-purple-700 border-purple-200",
}

export function ContactsTab({ companyId, initialContacts, branches = [] }: Props) {
  const [contacts, setContacts]   = useState<Contact[]>(initialContacts)
  const [showAdd, setShowAdd]     = useState(false)
  const [editing, setEditing]     = useState<Contact | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null)
  const [form, setForm]           = useState<FormShape>({ ...EMPTY })
  const [saving, setSaving]       = useState(false)

  function set(k: keyof FormShape, v: string | boolean | null) {
    setForm(f => ({ ...f, [k]: v }))
  }

  function openAdd() { setForm({ ...EMPTY }); setShowAdd(true) }

  function openEdit(c: Contact) {
    setForm({
      first_name: c.first_name, last_name: c.last_name,
      title: c.title, department: c.department,
      email: c.email, phone: c.phone,
      is_primary: c.is_primary, notes: c.notes,
      branch_id: c.branch_id,
      is_crm_contact: c.is_crm_contact,
      is_regulatory_contact: c.is_regulatory_contact,
      is_recruitment_contact: c.is_recruitment_contact,
    })
    setEditing(c)
  }

  async function handleAdd() {
    if (!form.first_name || !form.last_name) return
    setSaving(true)
    try {
      const res = await fetch(`/api/companies/${companyId}/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) { toast.error("Failed to add contact"); return }
      const created: Contact = await res.json()
      if (created.is_primary) {
        setContacts(prev => [created, ...prev.map(c => ({ ...c, is_primary: false }))])
      } else {
        setContacts(prev => [...prev, created])
      }
      setShowAdd(false)
      toast.success("Contact added")
    } finally { setSaving(false) }
  }

  async function handleEdit() {
    if (!editing || !form.first_name || !form.last_name) return
    setSaving(true)
    try {
      const res = await fetch(`/api/companies/${companyId}/contacts/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) { toast.error("Failed to update"); return }
      const updated: Contact = await res.json()
      if (updated.is_primary) {
        setContacts(prev => prev.map(c => c.id === updated.id ? updated : { ...c, is_primary: false }))
      } else {
        setContacts(prev => prev.map(c => c.id === updated.id ? updated : c))
      }
      setEditing(null)
      toast.success("Updated")
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setSaving(true)
    try {
      const res = await fetch(`/api/companies/${companyId}/contacts/${deleteTarget.id}`, { method: "DELETE" })
      if (!res.ok) { toast.error("Failed to delete"); return }
      setContacts(prev => prev.filter(c => c.id !== deleteTarget.id))
      setDeleteTarget(null)
      toast.success("Contact removed")
    } finally { setSaving(false) }
  }

  const branchMap = Object.fromEntries(branches.map(b => [b.id, b.name]))
  const active    = contacts.filter(c => c.is_active)
  const inactive  = contacts.filter(c => !c.is_active)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">{active.length} contact{active.length !== 1 ? "s" : ""}</p>
        <Button size="sm" onClick={openAdd} className="gap-1.5">
          <Plus className="h-4 w-4" />Add Contact
        </Button>
      </div>

      {active.length === 0 && (
        <div className="border rounded-lg text-center py-12 text-muted-foreground text-sm">
          No contacts yet. Add the first person at this company.
        </div>
      )}

      <div className="space-y-2">
        {active.map(c => (
          <div key={c.id} className="border rounded-lg px-4 py-3 flex items-start justify-between gap-4 group">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {c.is_primary && <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500 shrink-0" />}
                <span className="font-medium text-sm">{c.first_name} {c.last_name}</span>
                {c.title && <span className="text-muted-foreground text-xs">· {c.title}</span>}
                {c.department && <Badge variant="outline" className="text-xs">{c.department}</Badge>}
                {c.is_crm_contact          && <Badge variant="outline" className={`text-xs ${MODULE_BADGE.crm}`}>CRM</Badge>}
                {c.is_regulatory_contact   && <Badge variant="outline" className={`text-xs ${MODULE_BADGE.regulatory}`}>Regulatory</Badge>}
                {c.is_recruitment_contact  && <Badge variant="outline" className={`text-xs ${MODULE_BADGE.recruitment}`}>Recruitment</Badge>}
              </div>
              <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground flex-wrap">
                {c.email && <a href={`mailto:${c.email}`} className="flex items-center gap-1 hover:text-foreground"><Mail className="h-3 w-3" />{c.email}</a>}
                {c.phone && <a href={`tel:${c.phone}`} className="flex items-center gap-1 hover:text-foreground"><Phone className="h-3 w-3" />{c.phone}</a>}
                {c.branch_id && branchMap[c.branch_id] && (
                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{branchMap[c.branch_id]}</span>
                )}
              </div>
              {c.notes && <p className="text-xs text-muted-foreground mt-1 truncate max-w-md">{c.notes}</p>}
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(c)}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
        ))}
      </div>

      {inactive.length > 0 && (
        <p className="text-xs text-muted-foreground mt-4">{inactive.length} inactive contact{inactive.length !== 1 ? "s" : ""} hidden</p>
      )}

      {/* Add dialog */}
      <Dialog open={showAdd} onOpenChange={o => !o && setShowAdd(false)}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add contact</DialogTitle></DialogHeader>
          <ContactForm form={form} set={set} branches={branches} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={!form.first_name || !form.last_name || saving}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit contact</DialogTitle></DialogHeader>
          <ContactForm form={form} set={set} branches={branches} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={!form.first_name || !form.last_name || saving}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Remove {deleteTarget?.first_name} {deleteTarget?.last_name}?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-2">This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>Remove</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ContactForm({ form, set, branches }: {
  form: FormShape
  set: (k: keyof FormShape, v: string | boolean | null) => void
  branches: Branch[]
}) {
  return (
    <div className="space-y-3 py-1">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>First name *</Label>
          <Input value={form.first_name} onChange={e => set("first_name", e.target.value)} autoFocus />
        </div>
        <div className="space-y-1.5">
          <Label>Last name *</Label>
          <Input value={form.last_name} onChange={e => set("last_name", e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Job title</Label>
          <Input value={form.title ?? ""} onChange={e => set("title", e.target.value || null)} placeholder="e.g. Chief Chemist" />
        </div>
        <div className="space-y-1.5">
          <Label>Department</Label>
          <Input value={form.department ?? ""} onChange={e => set("department", e.target.value || null)} placeholder="e.g. R&D, Procurement" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Email</Label>
        <Input type="email" value={form.email ?? ""} onChange={e => set("email", e.target.value || null)} />
      </div>
      <div className="space-y-1.5">
        <Label>Phone</Label>
        <Input value={form.phone ?? ""} onChange={e => set("phone", e.target.value || null)} />
      </div>

      {branches.length > 0 && (
        <div className="space-y-1.5">
          <Label>Branch / Location</Label>
          <Select
            value={form.branch_id ?? "_none_"}
            onValueChange={v => set("branch_id", v === "_none_" ? null : v)}
          >
            <SelectTrigger><SelectValue placeholder="Not assigned" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_none_">Not assigned</SelectItem>
              {branches.map(b => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}{b.is_head_office ? " (Head Office)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Module access tags */}
      <div className="space-y-2">
        <Label>Module relevance</Label>
        <div className="flex flex-col gap-1.5">
          {[
            { key: "is_crm_contact"         as const, label: "CRM contact",         color: "text-blue-700" },
            { key: "is_regulatory_contact"  as const, label: "Regulatory contact",  color: "text-green-700" },
            { key: "is_recruitment_contact" as const, label: "Recruitment contact", color: "text-purple-700" },
          ].map(({ key, label, color }) => (
            <label key={key} className={`flex items-center gap-2 text-sm cursor-pointer ${color}`}>
              <input
                type="checkbox"
                checked={form[key] as boolean}
                onChange={e => set(key, e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Notes</Label>
        <Input value={form.notes ?? ""} onChange={e => set("notes", e.target.value || null)} placeholder="e.g. Prefers email, cc PM" />
      </div>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" checked={form.is_primary} onChange={e => set("is_primary", e.target.checked)} className="h-4 w-4 rounded" />
        Primary contact
      </label>
    </div>
  )
}
