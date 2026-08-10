"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { WorkScheduleFields, defaultWorkingHours, normalizeWorkingHours, type WorkHourEntry } from "./WorkScheduleFields"
import { Pencil } from "lucide-react"
import { toast } from "sonner"

export function EditWorkScheduleDialog({
  contractId, workingHours, lunchBreakMinutes, startTimeFirstDay, onSaved,
}: {
  contractId: string
  workingHours: WorkHourEntry[] | null
  lunchBreakMinutes: number | null
  startTimeFirstDay: string | null
  onSaved?: () => void
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [hours, setHours] = useState<WorkHourEntry[]>(
    workingHours && workingHours.length > 0 ? normalizeWorkingHours(workingHours) : defaultWorkingHours()
  )
  const [lunchBreak, setLunchBreak] = useState(lunchBreakMinutes != null ? String(lunchBreakMinutes) : "")
  const [startTimeFirst, setStartTimeFirst] = useState(startTimeFirstDay ?? "")
  const [saving, setSaving] = useState(false)

  async function handleSubmit() {
    setSaving(true)
    try {
      const res = await fetch(`/api/recruitment/contracts/${contractId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          working_hours: hours,
          lunch_break_minutes: lunchBreak ? Number(lunchBreak) : null,
          start_time_first_day: startTimeFirst || null,
        }),
      })
      if (!res.ok) { toast.error("Failed to save"); return }
      toast.success("Working hours updated")
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
          <DialogHeader><DialogTitle>Working hours & schedule</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <WorkScheduleFields value={hours} onChange={setHours} />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Lunch break (minutes)</Label>
                <Input type="number" value={lunchBreak} onChange={(e) => setLunchBreak(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Start time on first day</Label>
                <Input type="time" value={startTimeFirst} onChange={(e) => setStartTimeFirst(e.target.value)} />
              </div>
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
