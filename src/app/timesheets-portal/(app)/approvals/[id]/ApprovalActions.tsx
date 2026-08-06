"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { toast } from "sonner"

export function ApprovalActions({ timesheetId }: { timesheetId: string }) {
  const router = useRouter()
  const [declineOpen, setDeclineOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [saving, setSaving] = useState(false)

  async function handleApprove() {
    setSaving(true)
    try {
      const res = await fetch(`/api/timesheets-portal/timesheets/${timesheetId}/approve`, { method: "POST" })
      if (!res.ok) throw new Error("Failed to approve")
      toast.success("Timesheet approved")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve")
    } finally {
      setSaving(false)
    }
  }

  async function handleDecline() {
    if (!reason.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/timesheets-portal/timesheets/${timesheetId}/decline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      })
      if (!res.ok) throw new Error("Failed to decline")
      toast.success("Timesheet declined")
      setDeclineOpen(false)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to decline")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex justify-end gap-2 mt-4">
      <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setDeclineOpen(true)} disabled={saving}>
        Decline
      </Button>
      <Button onClick={handleApprove} disabled={saving}>Approve</Button>

      <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Decline timesheet</DialogTitle></DialogHeader>
          <div className="space-y-1.5 py-1">
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Let the contractor know what needs to change…"
              rows={4}
              autoFocus
              className="w-full text-sm rounded-md border border-border bg-background px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeclineOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDecline} disabled={!reason.trim() || saving}>Decline</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
