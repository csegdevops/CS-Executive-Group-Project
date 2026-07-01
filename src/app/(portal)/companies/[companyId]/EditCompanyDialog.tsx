"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { AddressAutocomplete, type AddressFields } from "@/components/ui/AddressAutocomplete"
import { Pencil } from "lucide-react"
import { toast } from "sonner"

interface Company {
  id: string
  name: string
  abn: string | null
  country: string | null
  industry: string | null
  notes: string | null
  is_active: boolean
  crm_status: string | null
  account_owner_id: string | null
  address_line1: string | null
  address_line2: string | null
  suburb: string | null
  state: string | null
  postcode: string | null
}

interface Profile {
  id: string
  full_name: string | null
}

interface Industry { value: string; label: string }

interface Props {
  company: Company
  profiles: Profile[]
}

// Radix SelectItem rejects empty string values — use a sentinel instead
const NONE = "_none_"
const toNull = (v: string) => (v === NONE || v === "") ? null : v

export function EditCompanyDialog({ company, profiles }: Props) {
  const router = useRouter()
  const [open, setOpen]               = useState(false)
  const [saving, setSaving]           = useState(false)
  const [archiveConfirm, setArchiveConfirm] = useState(false)
  const [industries, setIndustries]   = useState<Industry[]>([])

  const [form, setForm] = useState({
    name:             company.name,
    abn:              company.abn        ?? "",
    industry:         company.industry   ?? NONE,
    notes:            company.notes      ?? "",
    crm_status:       company.crm_status ?? "prospect",
    account_owner_id: company.account_owner_id ?? NONE,
  })

  const [address, setAddress] = useState<AddressFields>({
    address_line1: company.address_line1 ?? "",
    address_line2: company.address_line2 ?? "",
    suburb:        company.suburb        ?? "",
    state:         company.state         ?? "",
    postcode:      company.postcode      ?? "",
    country:       company.country       ?? "Australia",
  })

  useEffect(() => {
    if (!open) return
    fetch("/api/lookup-values?scope=global&category=company_industry")
      .then(r => r.json())
      .then(data => setIndustries(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [open])

  function set(k: keyof typeof form, v: string) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function handleSave() {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        name:             form.name.trim(),
        abn:              form.abn.trim()  || null,
        industry:         toNull(form.industry),
        notes:            form.notes.trim()|| null,
        crm_status:       form.crm_status,
        account_owner_id: toNull(form.account_owner_id),
        address_line1:    address.address_line1  || null,
        address_line2:    address.address_line2  || null,
        suburb:           address.suburb         || null,
        state:            address.state          || null,
        postcode:         address.postcode        || null,
        country:          address.country         || null,
      }
      const res = await fetch(`/api/companies/${company.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) { toast.error("Failed to save"); return }
      toast.success("Company updated")
      setOpen(false)
      router.refresh()
    } finally { setSaving(false) }
  }

  async function handleArchive() {
    setSaving(true)
    try {
      const res = await fetch(`/api/companies/${company.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !company.is_active }),
      })
      if (!res.ok) { toast.error("Failed"); return }
      toast.success(company.is_active ? "Company archived" : "Company restored")
      setOpen(false)
      setArchiveConfirm(false)
      router.refresh()
    } finally { setSaving(false) }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="gap-1.5">
        <Pencil className="h-3.5 w-3.5" />Edit
      </Button>

      <Dialog open={open} onOpenChange={o => { setOpen(o); setArchiveConfirm(false) }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit company</DialogTitle></DialogHeader>

          <div className="space-y-4 py-1">
            {/* Name */}
            <div className="space-y-1.5">
              <Label>Company name *</Label>
              <Input value={form.name} onChange={e => set("name", e.target.value)} />
            </div>

            {/* ABN + Industry */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>ABN</Label>
                <Input value={form.abn} onChange={e => set("abn", e.target.value)} placeholder="XX XXX XXX XXX" />
              </div>
              <div className="space-y-1.5">
                <Label>Industry</Label>
                <Select value={form.industry} onValueChange={v => set("industry", v)}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>— None —</SelectItem>
                    {industries.map(i => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* CRM fields */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>CRM status</Label>
                <Select value={form.crm_status} onValueChange={v => set("crm_status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lead">Lead</SelectItem>
                    <SelectItem value="prospect">Prospect</SelectItem>
                    <SelectItem value="client">Client</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Account owner</Label>
                <Select value={form.account_owner_id} onValueChange={v => set("account_owner_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Unassigned</SelectItem>
                    {profiles.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.full_name ?? p.id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <textarea
                rows={2}
                value={form.notes}
                onChange={e => set("notes", e.target.value)}
                className="w-full text-sm rounded-md border border-border bg-background px-3 py-2 resize-y focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            {/* Address */}
            <div className="border-t pt-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Head Office Address</p>
              <AddressAutocomplete value={address} onChange={setAddress} />
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <div className="flex-1">
              {!archiveConfirm ? (
                <Button
                  variant="ghost" size="sm"
                  className="text-muted-foreground hover:text-destructive text-xs"
                  onClick={() => setArchiveConfirm(true)}
                >
                  {company.is_active ? "Archive company" : "Restore company"}
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-destructive">Sure?</span>
                  <Button size="sm" variant="destructive" onClick={handleArchive} disabled={saving}>
                    {company.is_active ? "Archive" : "Restore"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setArchiveConfirm(false)}>Cancel</Button>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={!form.name.trim() || saving}>Save</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
