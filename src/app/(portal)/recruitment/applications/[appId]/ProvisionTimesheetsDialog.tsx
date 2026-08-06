"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { toast } from "sonner"

interface Branch { id: string; name: string; is_head_office: boolean }

export function ProvisionTimesheetsDialog({
  placementId, candidateId, candidateName, candidateEmail,
  companyId, companyName, startDate, finishDate, payRate, chargeRate, currency,
}: {
  placementId: string
  candidateId: string
  candidateName: string
  candidateEmail: string
  companyId: string
  companyName: string
  startDate: string
  finishDate: string | null
  payRate: number | null
  chargeRate: number | null
  currency: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [branches, setBranches] = useState<Branch[]>([])
  const [branchId, setBranchId] = useState("")
  const [email, setEmail] = useState(candidateEmail)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    fetch(`/api/companies/${companyId}/branches`)
      .then((r) => r.json())
      .then((data) => setBranches(Array.isArray(data) ? data : []))
      .catch(() => setBranches([]))
  }, [open, companyId])

  async function handleSubmit() {
    setSaving(true)
    try {
      const res = await fetch("/api/timesheets/contractors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: candidateName,
          email,
          company_id: companyId,
          branch_id: branchId || null,
          candidate_id: candidateId,
          placement_id: placementId,
          start_date: startDate,
          finish_date: finishDate,
          pay_rate: payRate,
          charge_rate: chargeRate,
          currency,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(typeof body.error === "string" ? body.error : "Failed to provision timesheets access")
      }
      const created = await res.json()
      toast.success(
        created.email_sent === false
          ? `${candidateName} provisioned — emails are paused, no invite sent`
          : `${candidateName} provisioned — a set-password email has been sent`
      )
      setOpen(false)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to provision timesheets access")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" className="w-full" onClick={() => setOpen(true)}>
        Provision Timesheets Access
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Provision timesheets access</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label>Contractor</Label>
              <p className="text-sm">{candidateName}</p>
            </div>
            <div className="space-y-1.5">
              <Label>Company</Label>
              <p className="text-sm">{companyName}</p>
            </div>
            <div className="space-y-1.5">
              <Label>Email (login) *</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            {branches.length > 0 && (
              <div className="space-y-1.5">
                <Label>Branch</Label>
                <Select value={branchId || "_none_"} onValueChange={(v) => setBranchId(v === "_none_" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Not assigned" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none_">Not assigned</SelectItem>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}{b.is_head_office ? " (Head Office)" : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Dates and rates carry over from the placement. Assign a supervisor afterward from the contractor&apos;s page.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!email || saving}>{saving ? "Provisioning…" : "Provision"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
