"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Pencil } from "lucide-react"
import { toast } from "sonner"

// Radix SelectItem rejects an empty string value.
const NONE = "_none_"

interface CompanyContact {
  id: string
  first_name: string
  last_name: string
  email: string | null
}

export interface ClientContactIds {
  recruitment_agreement_contact_id: string | null
  invoicing_contact_id: string | null
  timesheet_approver_contact_id: string | null
}

export function EditClientContactsDialog({
  contractId, companyId, current, onSaved,
}: {
  contractId: string
  companyId: string | null
  current: ClientContactIds
  onSaved?: () => void
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [contacts, setContacts] = useState<CompanyContact[]>([])
  const [loading, setLoading] = useState(false)
  const [agreementContact, setAgreementContact] = useState(current.recruitment_agreement_contact_id ?? NONE)
  const [invoicingContact, setInvoicingContact] = useState(current.invoicing_contact_id ?? NONE)
  const [approverContact, setApproverContact] = useState(current.timesheet_approver_contact_id ?? NONE)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !companyId) return
    setLoading(true)
    fetch(`/api/companies/${companyId}/contacts`)
      .then((res) => res.json())
      .then((data) => setContacts(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false))
  }, [open, companyId])

  async function handleSubmit() {
    setSaving(true)
    try {
      const res = await fetch(`/api/recruitment/contracts/${contractId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recruitment_agreement_contact_id: agreementContact === NONE ? null : agreementContact,
          invoicing_contact_id: invoicingContact === NONE ? null : invoicingContact,
          timesheet_approver_contact_id: approverContact === NONE ? null : approverContact,
        }),
      })
      if (!res.ok) { toast.error("Failed to save"); return }
      toast.success("Client contacts updated")
      setOpen(false)
      router.refresh()
      onSaved?.()
    } finally {
      setSaving(false)
    }
  }

  function ContactSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    return (
      <Select value={value} onValueChange={onChange} disabled={!companyId || loading}>
        <SelectTrigger><SelectValue placeholder="Not set" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>Not set</SelectItem>
          {contacts.map((c) => (
            <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}{c.email ? ` — ${c.email}` : ""}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  return (
    <>
      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setOpen(true)}>
        <Pencil className="h-3.5 w-3.5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Client contacts</DialogTitle></DialogHeader>
          {!companyId ? (
            <p className="text-sm text-muted-foreground">No company linked to this job yet.</p>
          ) : (
            <div className="space-y-3 py-1">
              <div className="space-y-1.5">
                <Label>Recruitment Agreement contact</Label>
                <ContactSelect value={agreementContact} onChange={setAgreementContact} />
              </div>
              <div className="space-y-1.5">
                <Label>Invoicing contact</Label>
                <ContactSelect value={invoicingContact} onChange={setInvoicingContact} />
              </div>
              <div className="space-y-1.5">
                <Label>Timesheet approver</Label>
                <ContactSelect value={approverContact} onChange={setApproverContact} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={saving || !companyId}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
