"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { AwardFields } from "./AwardFields"
import { Pencil } from "lucide-react"
import { toast } from "sonner"

export interface RateTerms {
  award: string | null
  award_level: string | null
  payment_terms_days: number | null
  overtime_applicable: boolean
  po_required: boolean
}

// Pay/charge/factor rate are only editable via Renew (a rate change is a new
// contract, not an in-place edit) — this dialog only covers the parts of
// Rate & Terms of Business that can change without starting a new contract.
export function EditRateTermsDialog({
  contractId, terms, onSaved,
}: {
  contractId: string
  terms: RateTerms
  onSaved?: () => void
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [award, setAward] = useState(terms.award ?? "")
  const [awardLevel, setAwardLevel] = useState(terms.award_level ?? "")
  const [paymentTermsDays, setPaymentTermsDays] = useState(terms.payment_terms_days != null ? String(terms.payment_terms_days) : "")
  const [overtimeApplicable, setOvertimeApplicable] = useState(terms.overtime_applicable)
  const [poRequired, setPoRequired] = useState(terms.po_required)
  const [saving, setSaving] = useState(false)

  async function handleSubmit() {
    setSaving(true)
    try {
      const res = await fetch(`/api/recruitment/contracts/${contractId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          award: award || null,
          award_level: awardLevel || null,
          payment_terms_days: paymentTermsDays ? Number(paymentTermsDays) : null,
          overtime_applicable: overtimeApplicable,
          po_required: poRequired,
        }),
      })
      if (!res.ok) { toast.error("Failed to save"); return }
      toast.success("Rate & terms updated")
      setOpen(false)
      router.refresh()
      onSaved?.()
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setOpen(true)}>
        <Pencil className="h-3.5 w-3.5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Rate & terms of business</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-1">
            <AwardFields award={award} awardLevel={awardLevel} onAwardChange={setAward} onAwardLevelChange={setAwardLevel} />
            <div className="space-y-1.5 col-span-2">
              <Label>Payment terms (days)</Label>
              <Input type="number" value={paymentTermsDays} onChange={(e) => setPaymentTermsDays(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1.5 text-sm">
              <Checkbox checked={overtimeApplicable} onCheckedChange={(c) => setOvertimeApplicable(!!c)} />Overtime applied
            </label>
            <label className="flex items-center gap-1.5 text-sm">
              <Checkbox checked={poRequired} onCheckedChange={(c) => setPoRequired(!!c)} />PO required
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
