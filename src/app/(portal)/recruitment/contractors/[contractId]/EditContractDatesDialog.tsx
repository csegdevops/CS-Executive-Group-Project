"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { CalendarCog } from "lucide-react"
import { toast } from "sonner"

// Separate from EditContractDetailsDialog because it's gated by a narrower
// permission (recruitment.contracts.edit_dates) — recruiters who can't
// extend/renew/terminate a contract can still correct its dates.
export function EditContractDatesDialog({
  contractId, startDate, finishDate, onSaved,
}: {
  contractId: string
  startDate: string | null
  finishDate: string | null
  onSaved?: () => void
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [start, setStart] = useState(startDate ?? "")
  const [finish, setFinish] = useState(finishDate ?? "")
  const [saving, setSaving] = useState(false)

  async function handleSubmit() {
    if (!start) return
    setSaving(true)
    try {
      const res = await fetch(`/api/recruitment/contracts/${contractId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start_date: start, finish_date: finish || null }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        toast.error(typeof err?.error === "string" ? err.error : "Failed to save dates")
        return
      }
      toast.success("Contract dates updated")
      setOpen(false)
      router.refresh()
      onSaved?.()
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setOpen(true)} title="Edit dates">
        <CalendarCog className="h-3.5 w-3.5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Contract dates</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-1">
            <div className="space-y-1.5">
              <Label>Start date *</Label>
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Finish date</Label>
              <Input type="date" value={finish} onChange={(e) => setFinish(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!start || saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
