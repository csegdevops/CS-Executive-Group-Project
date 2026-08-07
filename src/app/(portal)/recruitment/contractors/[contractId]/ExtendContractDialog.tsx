"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { toast } from "sonner"

export function ExtendContractDialog({
  contractId, currentFinishDate, currentPayRate, currentChargeRate,
}: {
  contractId: string
  currentFinishDate: string | null
  currentPayRate: number | null
  currentChargeRate: number | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [finishDate, setFinishDate] = useState("")
  const [payRate, setPayRate] = useState(currentPayRate != null ? String(currentPayRate) : "")
  const [chargeRate, setChargeRate] = useState(currentChargeRate != null ? String(currentChargeRate) : "")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  async function handleSubmit() {
    if (!finishDate) return
    setSaving(true)
    try {
      const res = await fetch(`/api/recruitment/contracts/${contractId}/extend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          new_finish_date: finishDate,
          new_pay_rate: payRate ? Number(payRate) : null,
          new_charge_rate: chargeRate ? Number(chargeRate) : null,
          notes: notes || undefined,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(typeof body.error === "string" ? body.error : "Failed to extend contract")
      }
      toast.success("Contract extended")
      setOpen(false)
      setFinishDate("")
      setNotes("")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to extend contract")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" className="w-full" onClick={() => setOpen(true)}>Extend contract</Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Extend contract</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-xs text-muted-foreground">Current finish date: {currentFinishDate ?? "Ongoing"}</p>
            <div className="space-y-1.5">
              <Label>New finish date *</Label>
              <Input type="date" value={finishDate} onChange={(e) => setFinishDate(e.target.value)} autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Pay rate</Label>
                <Input type="number" step="0.01" value={payRate} onChange={(e) => setPayRate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Charge rate</Label>
                <Input type="number" step="0.01" value={chargeRate} onChange={(e) => setChargeRate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full text-sm rounded-md border border-border bg-background px-2.5 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!finishDate || saving}>{saving ? "Extending…" : "Extend contract"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
