"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { toast } from "sonner"

interface Placement {
  id: string
  placement_type: "permanent" | "contract"
  start_date: string
  finish_date: string | null
  pay_rate: number | null
  charge_rate: number | null
  currency: string
}

const EMPTY = {
  placement_type: "contract" as "permanent" | "contract",
  start_date: "", finish_date: "",
  pay_rate: "", charge_rate: "", currency: "AUD",
  salary_package: "", placement_fee: "", fee_percentage: "",
}

export function CreatePlacementDialog({
  applicationId, jobId, candidateId, defaultPlacementType, onCreated,
}: {
  applicationId: string
  jobId: string
  candidateId: string
  defaultPlacementType: "permanent" | "contract"
  onCreated: (placement: Placement) => void
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ ...EMPTY, placement_type: defaultPlacementType })
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
          placement_type: form.placement_type,
          start_date: form.start_date,
          finish_date: form.finish_date || null,
          pay_rate: form.placement_type === "contract" && form.pay_rate ? Number(form.pay_rate) : null,
          charge_rate: form.placement_type === "contract" && form.charge_rate ? Number(form.charge_rate) : null,
          currency: form.currency,
          salary_package: form.placement_type === "permanent" && form.salary_package ? Number(form.salary_package) : null,
          placement_fee: form.placement_type === "permanent" && form.placement_fee ? Number(form.placement_fee) : null,
          fee_type: form.placement_type === "permanent" && form.placement_fee ? "fixed" : null,
          fee_percentage: form.placement_type === "permanent" && form.fee_percentage ? Number(form.fee_percentage) : null,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(typeof body.error === "string" ? body.error : "Failed to create placement")
      }
      const created = await res.json()
      toast.success("Placement created")
      setOpen(false)
      onCreated(created)
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
            <div className="space-y-1.5">
              <Label>Placement type</Label>
              <Select value={form.placement_type} onValueChange={(v) => set("placement_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="contract">Contract / Temporary</SelectItem>
                  <SelectItem value="permanent">Permanent</SelectItem>
                </SelectContent>
              </Select>
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

            {form.placement_type === "contract" ? (
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Pay rate</Label>
                  <Input type="number" step="0.01" value={form.pay_rate} onChange={(e) => set("pay_rate", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Charge rate</Label>
                  <Input type="number" step="0.01" value={form.charge_rate} onChange={(e) => set("charge_rate", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Currency</Label>
                  <Input value={form.currency} onChange={(e) => set("currency", e.target.value)} />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Salary package</Label>
                  <Input type="number" step="0.01" value={form.salary_package} onChange={(e) => set("salary_package", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Placement fee</Label>
                  <Input type="number" step="0.01" value={form.placement_fee} onChange={(e) => set("placement_fee", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Fee %</Label>
                  <Input type="number" step="0.01" value={form.fee_percentage} onChange={(e) => set("fee_percentage", e.target.value)} />
                </div>
              </div>
            )}

            {form.placement_type === "contract" && (
              <p className="text-xs text-muted-foreground">
                Contract placements can be provisioned for Timesheets Portal access once created.
              </p>
            )}
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
