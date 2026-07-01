"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { AddressAutocomplete } from "@/components/ui/AddressAutocomplete"
import type { AddressFields } from "@/lib/address"
import { emptyAddress, formatAddress } from "@/lib/address"
import { Plus, Pencil, Trash2, Star, Mail, Phone, MapPin, Building2 } from "lucide-react"
import { toast } from "sonner"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Branch {
  id: string
  name: string
  address_line1: string | null
  address_line2: string | null
  suburb: string | null
  state: string | null
  postcode: string | null
  country: string | null
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
  initialBranches: Branch[]
  initialContacts: Contact[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const NONE = "_none_"
const toNull = (v: string) => (v === NONE || v === "") ? null : v

const MODULE_BADGE: Record<string, string> = {
  crm:         "bg-blue-50  text-blue-700  border-blue-200",
  regulatory:  "bg-green-50 text-green-700 border-green-200",
  recruitment: "bg-purple-50 text-purple-700 border-purple-200",
}

function branchToAddr(b: Branch): AddressFields {
  return {
    address_line1: b.address_line1 ?? "",
    address_line2: b.address_line2 ?? "",
    suburb:        b.suburb        ?? "",
    state:         b.state         ?? "",
    postcode:      b.postcode      ?? "",
    country:       b.country       ?? "Australia",
  }
}

// ─── Contact form shape ───────────────────────────────────────────────────────

interface ContactForm {
  first_name: string
  last_name: string
  title: string
  department: string
  email: string
  phone: string
  is_primary: boolean
  notes: string
  branch_id: string      // uses NONE sentinel for null
  is_crm_contact: boolean
  is_regulatory_contact: boolean
  is_recruitment_contact: boolean
}

function emptyContact(branchId: string | null): ContactForm {
  return {
    first_name: "", last_name: "", title: "", department: "",
    email: "", phone: "", is_primary: false, notes: "",
    branch_id: branchId ?? NONE,
    is_crm_contact: true, is_regulatory_contact: false, is_recruitment_contact: false,
  }
}

function contactToForm(c: Contact): ContactForm {
  return {
    first_name:             c.first_name,
    last_name:              c.last_name,
    title:                  c.title      ?? "",
    department:             c.department ?? "",
    email:                  c.email      ?? "",
    phone:                  c.phone      ?? "",
    is_primary:             c.is_primary,
    notes:                  c.notes      ?? "",
    branch_id:              c.branch_id  ?? NONE,
    is_crm_contact:         c.is_crm_contact,
    is_regulatory_contact:  c.is_regulatory_contact,
    is_recruitment_contact: c.is_recruitment_contact,
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

export function BranchesContactsTab({ companyId, initialBranches, initialContacts }: Props) {
  const router = useRouter()
  const [branches, setBranches] = useState<Branch[]>(initialBranches)
  const [contacts, setContacts] = useState<Contact[]>(initialContacts.filter(c => c.is_active))
  const [saving, setSaving]     = useState(false)

  // Branch dialog
  const [branchMode, setBranchMode]       = useState<"add" | "edit" | null>(null)
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null)
  const [branchName, setBranchName]       = useState("")
  const [branchAddr, setBranchAddr]       = useState<AddressFields>(emptyAddress)

  // Contact dialog
  const [contactMode, setContactMode]       = useState<"add" | "edit" | null>(null)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [contactForm, setContactForm]       = useState<ContactForm>(emptyContact(null))
  const [deleteTarget, setDeleteTarget]     = useState<Contact | null>(null)

  // Branch dialog helpers
  function openAddBranch() {
    setBranchName(""); setBranchAddr(emptyAddress); setEditingBranch(null); setBranchMode("add")
  }
  function openEditBranch(b: Branch) {
    setBranchName(b.name); setBranchAddr(branchToAddr(b)); setEditingBranch(b); setBranchMode("edit")
  }

  // Contact dialog helpers
  function openAddContact(branchId: string | null) {
    setContactForm(emptyContact(branchId)); setEditingContact(null); setContactMode("add")
  }
  function openEditContact(c: Contact) {
    setContactForm(contactToForm(c)); setEditingContact(c); setContactMode("edit")
  }

  function setContactField<K extends keyof ContactForm>(k: K, v: ContactForm[K]) {
    setContactForm(f => ({ ...f, [k]: v }))
  }

  // ── Branch CRUD ─────────────────────────────────────────────────────────────

  async function handleSaveBranch() {
    if (!branchName.trim()) return
    setSaving(true)
    try {
      if (branchMode === "add") {
        const res = await fetch(`/api/companies/${companyId}/branches`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name:          branchName.trim(),
            address_line1: branchAddr.address_line1 || null,
            address_line2: branchAddr.address_line2 || null,
            suburb:        branchAddr.suburb        || null,
            state:         branchAddr.state         || null,
            postcode:      branchAddr.postcode       || null,
            country:       branchAddr.country        || null,
          }),
        })
        if (!res.ok) { toast.error("Failed to add branch"); return }
        const created = await res.json()
        setBranches(prev => [...prev, created])
        toast.success("Branch added")
      } else if (editingBranch) {
        const res = await fetch(`/api/companies/${companyId}/branches/${editingBranch.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name:          branchName.trim(),
            address_line1: branchAddr.address_line1 || null,
            address_line2: branchAddr.address_line2 || null,
            suburb:        branchAddr.suburb        || null,
            state:         branchAddr.state         || null,
            postcode:      branchAddr.postcode       || null,
            country:       branchAddr.country        || null,
          }),
        })
        if (!res.ok) { toast.error("Failed to save"); return }
        const updated = await res.json()
        setBranches(prev => prev.map(b => b.id === editingBranch.id ? updated : b))
        toast.success("Branch updated")
      }
      setBranchMode(null)
      router.refresh()
    } finally { setSaving(false) }
  }

  async function handleDeleteBranch(branch: Branch) {
    if (!confirm(`Remove branch "${branch.name}"?`)) return
    const res = await fetch(`/api/companies/${companyId}/branches/${branch.id}`, { method: "DELETE" })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      toast.error(err.error ?? "Cannot delete — contacts are still assigned to this branch")
      return
    }
    setBranches(prev => prev.filter(b => b.id !== branch.id))
    toast.success("Branch removed")
    router.refresh()
  }

  // ── Contact CRUD ────────────────────────────────────────────────────────────

  function buildContactBody() {
    return {
      first_name:             contactForm.first_name.trim(),
      last_name:              contactForm.last_name.trim(),
      title:                  contactForm.title.trim()      || null,
      department:             contactForm.department.trim() || null,
      email:                  contactForm.email.trim()      || null,
      phone:                  contactForm.phone.trim()      || null,
      is_primary:             contactForm.is_primary,
      notes:                  contactForm.notes.trim()      || null,
      branch_id:              toNull(contactForm.branch_id),
      is_crm_contact:         contactForm.is_crm_contact,
      is_regulatory_contact:  contactForm.is_regulatory_contact,
      is_recruitment_contact: contactForm.is_recruitment_contact,
    }
  }

  async function handleAddContact() {
    if (!contactForm.first_name || !contactForm.last_name) return
    setSaving(true)
    try {
      const res = await fetch(`/api/companies/${companyId}/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildContactBody()),
      })
      if (!res.ok) { toast.error("Failed to add contact"); return }
      const created: Contact = await res.json()
      setContacts(prev =>
        created.is_primary
          ? [created, ...prev.map(c => ({ ...c, is_primary: false }))]
          : [...prev, created]
      )
      setContactMode(null)
      toast.success("Contact added")
    } finally { setSaving(false) }
  }

  async function handleEditContact() {
    if (!editingContact || !contactForm.first_name || !contactForm.last_name) return
    setSaving(true)
    try {
      const res = await fetch(`/api/companies/${companyId}/contacts/${editingContact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildContactBody()),
      })
      if (!res.ok) { toast.error("Failed to update"); return }
      const updated: Contact = await res.json()
      setContacts(prev =>
        updated.is_primary
          ? prev.map(c => c.id === updated.id ? updated : { ...c, is_primary: false })
          : prev.map(c => c.id === updated.id ? updated : c)
      )
      setContactMode(null)
      toast.success("Updated")
    } finally { setSaving(false) }
  }

  async function handleDeleteContact() {
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

  // ── Render ──────────────────────────────────────────────────────────────────

  const headOffice  = branches.find(b => b.is_head_office)
  const otherBranches = branches.filter(b => !b.is_head_office)
  const orderedBranches = headOffice ? [headOffice, ...otherBranches] : otherBranches
  const unassigned  = contacts.filter(c => !c.branch_id || !branches.find(b => b.id === c.branch_id))

  return (
    <div className="space-y-4">
      {/* Branch sections */}
      {orderedBranches.map(branch => {
        const branchContacts = contacts.filter(c => c.branch_id === branch.id)
        const addr = formatAddress({
          address_line1: branch.address_line1 ?? undefined,
          suburb:        branch.suburb        ?? undefined,
          state:         branch.state         ?? undefined,
          postcode:      branch.postcode      ?? undefined,
        })

        return (
          <div key={branch.id} className="border rounded-lg overflow-hidden">
            {/* Branch header */}
            <div className="flex items-center justify-between px-4 py-3 bg-muted/40 border-b gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-medium text-sm">{branch.name}</span>
                {branch.is_head_office && (
                  <Badge variant="outline" className="text-xs gap-1 text-amber-600 border-amber-200 bg-amber-50 shrink-0">
                    <Star className="h-2.5 w-2.5 fill-amber-500" />Head Office
                  </Badge>
                )}
                {addr && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                    <MapPin className="h-3 w-3 shrink-0" />{addr}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs"
                  onClick={() => openAddContact(branch.id)}>
                  <Plus className="h-3 w-3" />Add Contact
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7"
                  onClick={() => openEditBranch(branch)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                {!branch.is_head_office && (
                  <Button size="icon" variant="ghost"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => handleDeleteBranch(branch)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>

            {/* Contacts in this branch */}
            {branchContacts.length === 0 ? (
              <div className="px-4 py-5 text-center text-sm text-muted-foreground">
                No contacts at this location.{" "}
                <button className="underline underline-offset-2 hover:text-foreground"
                  onClick={() => openAddContact(branch.id)}>
                  Add one
                </button>
              </div>
            ) : (
              <div className="divide-y">
                {branchContacts.map(c => (
                  <ContactRow
                    key={c.id}
                    contact={c}
                    onEdit={() => openEditContact(c)}
                    onDelete={() => setDeleteTarget(c)}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}

      {/* Unassigned contacts (no branch or orphaned branch_id) */}
      {unassigned.length > 0 && (
        <div className="border rounded-lg overflow-hidden border-dashed">
          <div className="px-4 py-3 bg-muted/20 border-b">
            <span className="text-sm font-medium text-muted-foreground">Unassigned</span>
          </div>
          <div className="divide-y">
            {unassigned.map(c => (
              <ContactRow
                key={c.id}
                contact={c}
                onEdit={() => openEditContact(c)}
                onDelete={() => setDeleteTarget(c)}
              />
            ))}
          </div>
        </div>
      )}

      {/* No branches at all */}
      {branches.length === 0 && (
        <div className="border rounded-lg text-center py-10 text-muted-foreground text-sm">
          No branches yet. Add an address when editing the company to auto-create Head Office,
          or add a branch manually below.
        </div>
      )}

      {/* Add branch button */}
      <Button size="sm" variant="outline" onClick={openAddBranch} className="gap-1.5">
        <Plus className="h-4 w-4" />Add Branch
      </Button>

      {/* ── Branch dialog ── */}
      <Dialog open={branchMode !== null} onOpenChange={o => !o && setBranchMode(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{branchMode === "add" ? "Add branch" : `Edit — ${editingBranch?.name}`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label>Branch name *</Label>
              <Input
                value={branchName}
                onChange={e => setBranchName(e.target.value)}
                placeholder="e.g. Melbourne Office"
                autoFocus
              />
            </div>
            <AddressAutocomplete value={branchAddr} onChange={setBranchAddr} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBranchMode(null)}>Cancel</Button>
            <Button onClick={handleSaveBranch} disabled={!branchName.trim() || saving}>
              {branchMode === "add" ? "Add" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Contact add/edit dialog ── */}
      <Dialog open={contactMode !== null} onOpenChange={o => !o && setContactMode(null)}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{contactMode === "add" ? "Add contact" : "Edit contact"}</DialogTitle>
          </DialogHeader>
          <ContactForm
            form={contactForm}
            set={setContactField}
            branches={branches}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setContactMode(null)}>Cancel</Button>
            <Button
              onClick={contactMode === "add" ? handleAddContact : handleEditContact}
              disabled={!contactForm.first_name || !contactForm.last_name || saving}
            >
              {contactMode === "add" ? "Add" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete contact confirm ── */}
      <Dialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove {deleteTarget?.first_name} {deleteTarget?.last_name}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteContact} disabled={saving}>Remove</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Contact row ──────────────────────────────────────────────────────────────

function ContactRow({ contact: c, onEdit, onDelete }: {
  contact: Contact
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="px-4 py-3 flex items-start justify-between gap-4 group hover:bg-muted/20">
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
        <div className="flex items-center gap-4 mt-0.5 text-xs text-muted-foreground flex-wrap">
          {c.email && <a href={`mailto:${c.email}`} className="flex items-center gap-1 hover:text-foreground"><Mail className="h-3 w-3" />{c.email}</a>}
          {c.phone && <a href={`tel:${c.phone}`}   className="flex items-center gap-1 hover:text-foreground"><Phone className="h-3 w-3" />{c.phone}</a>}
        </div>
        {c.notes && <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-md">{c.notes}</p>}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

// ─── Contact form ─────────────────────────────────────────────────────────────

function ContactForm({ form, set, branches }: {
  form: ContactForm
  set: <K extends keyof ContactForm>(k: K, v: ContactForm[K]) => void
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
          <Input value={form.title} onChange={e => set("title", e.target.value)} placeholder="e.g. Chief Chemist" />
        </div>
        <div className="space-y-1.5">
          <Label>Department</Label>
          <Input value={form.department} onChange={e => set("department", e.target.value)} placeholder="e.g. R&D" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input type="email" value={form.email} onChange={e => set("email", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Phone</Label>
          <Input value={form.phone} onChange={e => set("phone", e.target.value)} />
        </div>
      </div>

      {/* Branch assignment */}
      {branches.length > 0 && (
        <div className="space-y-1.5">
          <Label>Branch / Location</Label>
          <Select value={form.branch_id} onValueChange={v => set("branch_id", v)}>
            <SelectTrigger><SelectValue placeholder="Not assigned" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Not assigned</SelectItem>
              {branches.map(b => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}{b.is_head_office ? " (Head Office)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Module flags */}
      <div className="space-y-2">
        <Label>Module relevance</Label>
        <div className="flex flex-col gap-1.5">
          {([
            { key: "is_crm_contact"         , label: "CRM contact",         color: "text-blue-700"   },
            { key: "is_regulatory_contact"  , label: "Regulatory contact",  color: "text-green-700"  },
            { key: "is_recruitment_contact" , label: "Recruitment contact", color: "text-purple-700" },
          ] as const).map(({ key, label, color }) => (
            <label key={key} className={`flex items-center gap-2 text-sm cursor-pointer select-none ${color}`}>
              <input
                type="checkbox"
                checked={form[key]}
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
        <Input value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="e.g. Prefers email" />
      </div>

      <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
        <input
          type="checkbox"
          checked={form.is_primary}
          onChange={e => set("is_primary", e.target.checked)}
          className="h-4 w-4 rounded"
        />
        Primary contact
      </label>
    </div>
  )
}
