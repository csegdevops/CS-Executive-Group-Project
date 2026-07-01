"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { AddressAutocomplete, type AddressFields, formatAddress } from "@/components/ui/AddressAutocomplete"
import { Plus, Pencil, Building2, Star } from "lucide-react"
import { toast } from "sonner"

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

interface Props {
  companyId: string
  initialBranches: Branch[]
}

const emptyAddr: AddressFields = {
  address_line1: "", address_line2: "", suburb: "", state: "", postcode: "", country: "Australia"
}

function branchToAddr(b: Branch): AddressFields {
  return {
    address_line1: b.address_line1 ?? "",
    address_line2: b.address_line2 ?? "",
    suburb:        b.suburb        ?? "",
    state:         b.state         ?? "",
    postcode:      b.postcode       ?? "",
    country:       b.country        ?? "Australia",
  }
}

export function BranchesTab({ companyId, initialBranches }: Props) {
  const router  = useRouter()
  const [branches, setBranches] = useState<Branch[]>(initialBranches)
  const [adding, setAdding]     = useState(false)
  const [editing, setEditing]   = useState<Branch | null>(null)
  const [saving, setSaving]     = useState(false)

  // Form state for add/edit
  const [formName, setFormName] = useState("")
  const [formAddr, setFormAddr] = useState<AddressFields>(emptyAddr)

  function openAdd() {
    setFormName(""); setFormAddr(emptyAddr); setAdding(true)
  }

  function openEdit(b: Branch) {
    setFormName(b.name); setFormAddr(branchToAddr(b)); setEditing(b)
  }

  async function handleAdd() {
    if (!formName.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/companies/${companyId}/branches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:          formName.trim(),
          address_line1: formAddr.address_line1 || null,
          address_line2: formAddr.address_line2 || null,
          suburb:        formAddr.suburb        || null,
          state:         formAddr.state         || null,
          postcode:      formAddr.postcode       || null,
          country:       formAddr.country        || null,
        }),
      })
      if (!res.ok) { toast.error("Failed to add branch"); return }
      const created = await res.json()
      setBranches(prev => [...prev, created])
      setAdding(false)
      toast.success("Branch added")
      router.refresh()
    } finally { setSaving(false) }
  }

  async function handleEdit() {
    if (!editing || !formName.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/companies/${companyId}/branches/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:          formName.trim(),
          address_line1: formAddr.address_line1 || null,
          address_line2: formAddr.address_line2 || null,
          suburb:        formAddr.suburb        || null,
          state:         formAddr.state         || null,
          postcode:      formAddr.postcode       || null,
          country:       formAddr.country        || null,
        }),
      })
      if (!res.ok) { toast.error("Failed to save"); return }
      const updated = await res.json()
      setBranches(prev => prev.map(b => b.id === editing.id ? updated : b))
      setEditing(null)
      toast.success("Branch updated")
      router.refresh()
    } finally { setSaving(false) }
  }

  async function handleDelete(branch: Branch) {
    if (!confirm(`Remove branch "${branch.name}"?`)) return
    const res = await fetch(`/api/companies/${companyId}/branches/${branch.id}`, { method: "DELETE" })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      toast.error(err.error ?? "Failed to remove")
      return
    }
    setBranches(prev => prev.filter(b => b.id !== branch.id))
    toast.success("Branch removed")
    router.refresh()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">{branches.length} branch{branches.length !== 1 ? "es" : ""}</p>
        <Button size="sm" onClick={openAdd} className="gap-1.5">
          <Plus className="h-4 w-4" />Add Branch
        </Button>
      </div>

      {branches.length === 0 ? (
        <div className="border rounded-lg text-center py-12 text-muted-foreground text-sm">
          No branches. The head office is created automatically when an address is provided on the company.
        </div>
      ) : (
        <div className="space-y-3">
          {branches.map(b => (
            <div key={b.id} className="border rounded-lg p-4 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 p-1.5 bg-muted rounded-md shrink-0">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{b.name}</p>
                    {b.is_head_office && (
                      <Badge variant="outline" className="text-xs gap-1 text-amber-600 border-amber-200 bg-amber-50">
                        <Star className="h-2.5 w-2.5 fill-amber-500" />Head Office
                      </Badge>
                    )}
                  </div>
                  {formatAddress({ address_line1: b.address_line1 ?? undefined, suburb: b.suburb ?? undefined, state: b.state ?? undefined, postcode: b.postcode ?? undefined, country: b.country ?? undefined }) && (
                    <p className="text-xs text-muted-foreground mt-0.5">{formatAddress({ address_line1: b.address_line1 ?? undefined, suburb: b.suburb ?? undefined, state: b.state ?? undefined, postcode: b.postcode ?? undefined, country: b.country ?? undefined })}</p>
                  )}
                </div>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => openEdit(b)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                {!b.is_head_office && (
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive" onClick={() => handleDelete(b)}>
                    ✕
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add dialog */}
      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add branch</DialogTitle></DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label>Branch name *</Label>
              <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. Melbourne Office" autoFocus />
            </div>
            <AddressAutocomplete value={formAddr} onChange={setFormAddr} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdding(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={!formName.trim() || saving}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit branch</DialogTitle></DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label>Branch name *</Label>
              <Input value={formName} onChange={e => setFormName(e.target.value)} />
            </div>
            <AddressAutocomplete value={formAddr} onChange={setFormAddr} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={!formName.trim() || saving}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
