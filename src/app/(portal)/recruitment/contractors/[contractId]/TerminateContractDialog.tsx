"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { toast } from "sonner"

export function TerminateContractDialog({ contractId, onSaved }: { contractId: string; onSaved?: () => void }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [saving, setSaving] = useState(false)

  async function handleSubmit() {
    setSaving(true)
    try {
      const res = await fetch(`/api/recruitment/contracts/${contractId}/terminate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason || undefined }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(typeof body.error === "string" ? body.error : "Failed to terminate contract")
      }
      toast.success("Contract terminated")
      setOpen(false)
      router.refresh()
      onSaved?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to terminate contract")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" className="w-full text-destructive hover:text-destructive" onClick={() => setOpen(true)}>
        Terminate contract
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Terminate contract</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-sm text-muted-foreground">This ends the contract early. It can&apos;t be undone from here — a terminated contract would need a new placement to resume work with this contractor.</p>
            <div className="space-y-1.5">
              <Label>Reason (optional)</Label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                className="w-full text-sm rounded-md border border-border bg-background px-2.5 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleSubmit} disabled={saving}>{saving ? "Terminating…" : "Terminate"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
