"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { toast } from "sonner"

const EMPTY = { start_date: "", finish_date: "" }

export function CreatePlacementDialog({
  applicationId, jobId, candidateId, jobTitle, companyName, placementType,
}: {
  applicationId: string
  jobId: string
  candidateId: string
  jobTitle: string | null
  companyName: string | null
  placementType: "permanent" | "contract"
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  function set(k: keyof typeof EMPTY, v: string) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  const valid = form.start_date

  async function handleSubmit() {
    if (!valid) return
    setSaving(true)
    try {
      const res = await fetch("/api/recruitment/placements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          application_id: applicationId,
          job_id: jobId,
          candidate_id: candidateId,
          placement_type: placementType,
          start_date: form.start_date,
          finish_date: form.finish_date || null,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(typeof body.error === "string" ? body.error : "Failed to create placement")
      }
      toast.success("Placement created")
      setOpen(false)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create placement")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Button size="sm" className="w-full" onClick={() => setOpen(true)}>Mark as Placed</Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Create placement</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div className="rounded-md border bg-muted/30 p-3 space-y-1">
              <p className="text-sm font-medium">{jobTitle ?? "Job"}</p>
              {companyName && <p className="text-xs text-muted-foreground">{companyName}</p>}
              <Badge variant="outline" className="mt-1 text-xs">
                {placementType === "contract" ? "Contract / Temporary" : "Permanent"}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start date *</Label>
                <Input type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label>Finish date</Label>
                <Input type="date" value={form.finish_date} onChange={(e) => set("finish_date", e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!valid || saving}>{saving ? "Creating…" : "Create placement"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
