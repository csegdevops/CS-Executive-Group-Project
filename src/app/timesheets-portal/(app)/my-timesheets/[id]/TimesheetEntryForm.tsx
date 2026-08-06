"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"

interface Timesheet {
  id: string
  week_starting: string
  status: string
  decline_reason: string | null
  is_template: boolean
}
interface Entry { work_date: string; hours: number; description: string | null }

const STATUS_BADGE: Record<string, string> = {
  draft:     "bg-muted text-muted-foreground border-border",
  submitted: "bg-blue-50 text-blue-700 border-blue-200",
  approved:  "bg-green-50 text-green-700 border-green-200",
  declined:  "bg-red-50 text-red-700 border-red-200",
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

function weekDates(weekStarting: string): string[] {
  const start = new Date(weekStarting)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    return d.toISOString().slice(0, 10)
  })
}

export function TimesheetEntryForm({ timesheet, initialEntries }: { timesheet: Timesheet; initialEntries: Entry[] }) {
  const router = useRouter()
  const dates = useMemo(() => weekDates(timesheet.week_starting), [timesheet.week_starting])
  const entryMap = useMemo(() => Object.fromEntries(initialEntries.map((e) => [e.work_date, e])), [initialEntries])

  const [rows, setRows] = useState(() =>
    dates.map((date) => ({
      work_date: date,
      hours: entryMap[date]?.hours != null ? String(entryMap[date].hours) : "",
      description: entryMap[date]?.description ?? "",
    }))
  )
  const [saving, setSaving] = useState<"draft" | "submit" | null>(null)

  const editable = timesheet.status === "draft" || timesheet.status === "declined"
  const total = rows.reduce((sum, r) => sum + (parseFloat(r.hours) || 0), 0)

  function updateRow(i: number, field: "hours" | "description", value: string) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)))
  }

  async function saveEntries() {
    const entries = rows
      .filter((r) => r.hours !== "" && parseFloat(r.hours) > 0)
      .map((r) => ({ work_date: r.work_date, hours: parseFloat(r.hours), description: r.description || null }))

    const res = await fetch(`/api/timesheets-portal/timesheets/${timesheet.id}/entries`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(typeof body.error === "string" ? body.error : "Failed to save")
    }
  }

  async function handleSaveDraft() {
    setSaving("draft")
    try {
      await saveEntries()
      toast.success(timesheet.is_template ? "Template saved" : "Draft saved")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSaving(null)
    }
  }

  async function handleSubmit() {
    setSaving("submit")
    try {
      await saveEntries()
      const res = await fetch(`/api/timesheets-portal/timesheets/${timesheet.id}/submit`, { method: "POST" })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(typeof body.error === "string" ? body.error : "Failed to submit")
      }
      toast.success(timesheet.status === "declined" ? "Timesheet resubmitted" : "Timesheet submitted")
      router.push("/my-timesheets")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit")
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">
          {timesheet.is_template ? "Template" : `Week of ${timesheet.week_starting}`}
        </h1>
        {!timesheet.is_template && (
          <Badge variant="outline" className={`text-xs ${STATUS_BADGE[timesheet.status] ?? ""}`}>{timesheet.status}</Badge>
        )}
      </div>

      {timesheet.status === "declined" && timesheet.decline_reason && (
        <div className="rounded-md bg-red-50 border border-red-200 px-3 py-3 text-sm text-red-800">
          <p className="font-medium mb-0.5">Declined</p>
          <p>{timesheet.decline_reason}</p>
        </div>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Daily hours</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {rows.map((row, i) => (
              <div key={row.work_date} className="grid grid-cols-[3rem_5rem_1fr] gap-3 items-center">
                <span className="text-sm text-muted-foreground">{DAY_LABELS[i]}</span>
                <Input
                  type="number" step="0.25" min="0" max="24"
                  value={row.hours}
                  disabled={!editable}
                  onChange={(e) => updateRow(i, "hours", e.target.value)}
                  placeholder="0"
                />
                <Input
                  value={row.description}
                  disabled={!editable}
                  onChange={(e) => updateRow(i, "description", e.target.value)}
                  placeholder="What did you work on?"
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end mt-3 pt-3 border-t text-sm font-medium">
            Total: {total.toFixed(2)} hrs
          </div>
        </CardContent>
      </Card>

      {editable && (
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleSaveDraft} disabled={saving !== null}>
            {saving === "draft" ? "Saving…" : timesheet.is_template ? "Save template" : "Save draft"}
          </Button>
          {!timesheet.is_template && (
            <Button onClick={handleSubmit} disabled={saving !== null || total === 0}>
              {saving === "submit" ? "Submitting…" : timesheet.status === "declined" ? "Resubmit" : "Submit"}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
