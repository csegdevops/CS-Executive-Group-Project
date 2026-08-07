"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Pencil } from "lucide-react"
import { toast } from "sonner"

export function EditContractDetailsDialog({
  contractId, contractNumber, noticePeriod,
}: {
  contractId: string
  contractNumber: string | null
  noticePeriod: string | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [number, setNumber] = useState(contractNumber ?? "")
  const [notice, setNotice] = useState(noticePeriod ?? "")
  const [saving, setSaving] = useState(false)

  async function handleSubmit() {
    setSaving(true)
    try {
      const res = await fetch(`/api/recruitment/contracts/${contractId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contract_number: number || null, notice_period: notice || null }),
      })
      if (!res.ok) { toast.error("Failed to save"); return }
      toast.success("Contract details updated")
      setOpen(false)
      router.refresh()
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
          <DialogHeader><DialogTitle>Contract details</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label>Contract number</Label>
              <Input value={number} onChange={(e) => setNumber(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Notice period</Label>
              <textarea
                value={notice}
                onChange={(e) => setNotice(e.target.value)}
                rows={2}
                placeholder="e.g. 4 weeks written notice by either party"
                className="w-full text-sm rounded-md border border-border bg-background px-2.5 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
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
