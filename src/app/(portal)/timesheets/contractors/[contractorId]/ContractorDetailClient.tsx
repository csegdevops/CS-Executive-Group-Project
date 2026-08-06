"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { toast } from "sonner"

interface Supervisor { id: string; full_name: string; email: string }
interface Contract {
  id: string
  finish_date: string | null
  status: string
}

export function ContractorDetailClient({
  contractorId, contract, companySupervisors, activeSupervisorId,
}: {
  contractorId: string
  contract: Contract | null
  companySupervisors: Supervisor[]
  activeSupervisorId: string | null
}) {
  const router = useRouter()
  const [supervisorDialogOpen, setSupervisorDialogOpen] = useState(false)
  const [extendDialogOpen, setExtendDialogOpen] = useState(false)
  const [selectedSupervisor, setSelectedSupervisor] = useState("")
  const [newFinishDate, setNewFinishDate] = useState(contract?.finish_date ?? "")
  const [saving, setSaving] = useState(false)

  async function handleChangeSupervisor() {
    if (!selectedSupervisor) return
    setSaving(true)
    try {
      const res = await fetch(`/api/timesheets/contractors/${contractorId}/supervisor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supervisor_id: selectedSupervisor }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(typeof body.error === "string" ? body.error : "Failed to change supervisor")
      }
      toast.success("Supervisor updated")
      setSupervisorDialogOpen(false)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to change supervisor")
    } finally {
      setSaving(false)
    }
  }

  async function handleExtend() {
    if (!contract) return
    setSaving(true)
    try {
      const res = await fetch(`/api/timesheets/contracts/${contract.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ finish_date: newFinishDate || null }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(typeof body.error === "string" ? body.error : "Failed to extend contract")
      }
      toast.success("Contract updated")
      setExtendDialogOpen(false)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to extend contract")
    } finally {
      setSaving(false)
    }
  }

  async function handleTerminate() {
    if (!contract) return
    if (!confirm("Terminate this contract? The contractor will no longer be able to submit timesheets.")) return
    setSaving(true)
    try {
      const res = await fetch(`/api/timesheets/contracts/${contract.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "terminated" }),
      })
      if (!res.ok) throw new Error("Failed to terminate contract")
      toast.success("Contract terminated")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to terminate contract")
    } finally {
      setSaving(false)
    }
  }

  const eligibleSupervisors = companySupervisors.filter((s) => s.id !== activeSupervisorId)

  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" onClick={() => setSupervisorDialogOpen(true)}>
        {activeSupervisorId ? "Change supervisor" : "Assign supervisor"}
      </Button>
      {contract && contract.status === "active" && (
        <>
          <Button size="sm" variant="outline" onClick={() => setExtendDialogOpen(true)}>Extend contract</Button>
          <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={handleTerminate} disabled={saving}>
            Terminate contract
          </Button>
        </>
      )}

      <Dialog open={supervisorDialogOpen} onOpenChange={setSupervisorDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{activeSupervisorId ? "Change supervisor" : "Assign supervisor"}</DialogTitle></DialogHeader>
          {eligibleSupervisors.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              No other supervisors exist for this company yet — provision one from the Supervisors page first.
            </p>
          ) : (
            <div className="space-y-1.5 py-1">
              <Label>Supervisor</Label>
              <Select value={selectedSupervisor} onValueChange={setSelectedSupervisor}>
                <SelectTrigger><SelectValue placeholder="Select a supervisor" /></SelectTrigger>
                <SelectContent>
                  {eligibleSupervisors.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.full_name} ({s.email})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSupervisorDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleChangeSupervisor} disabled={!selectedSupervisor || saving}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={extendDialogOpen} onOpenChange={setExtendDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Extend contract</DialogTitle></DialogHeader>
          <div className="space-y-1.5 py-1">
            <Label>New finish date</Label>
            <Input type="date" value={newFinishDate ?? ""} onChange={(e) => setNewFinishDate(e.target.value)} />
            <p className="text-xs text-muted-foreground">Leave blank for an open-ended (ongoing) contract.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExtendDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleExtend} disabled={saving}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
