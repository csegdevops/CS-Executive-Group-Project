"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"

interface TimesheetRow {
  id: string
  week_starting: string
  status: string
  decline_reason: string | null
  is_template: boolean
  submitted_at: string | null
}

const STATUS_BADGE: Record<string, string> = {
  draft:     "bg-muted text-muted-foreground border-border",
  submitted: "bg-blue-50 text-blue-700 border-blue-200",
  approved:  "bg-green-50 text-green-700 border-green-200",
  declined:  "bg-red-50 text-red-700 border-red-200",
}

function mondayOf(date: Date): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

export function MyTimesheetsClient({ weeks, templates }: { weeks: TimesheetRow[]; templates: TimesheetRow[] }) {
  const router = useRouter()
  const [starting, setStarting] = useState(false)
  const [templateId, setTemplateId] = useState("")

  async function startWeek(fromTemplateId?: string) {
    const weekStarting = mondayOf(new Date())
    const existing = weeks.find((w) => w.week_starting === weekStarting)
    if (existing) { router.push(`/my-timesheets/${existing.id}`); return }

    setStarting(true)
    try {
      const res = await fetch("/api/timesheets-portal/timesheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ week_starting: weekStarting, from_template_id: fromTemplateId ?? null }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(typeof body.error === "string" ? body.error : "Failed to start this week's timesheet")
      }
      const created = await res.json()
      router.push(`/my-timesheets/${created.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start this week's timesheet")
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">My Timesheets</h1>
        <div className="flex items-center gap-2">
          {templates.length > 0 && (
            <>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger className="w-44"><SelectValue placeholder="From template…" /></SelectTrigger>
                <SelectContent>
                  {templates.map((t) => <SelectItem key={t.id} value={t.id}>Template ({t.week_starting})</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" disabled={!templateId || starting} onClick={() => startWeek(templateId)}>
                Use template
              </Button>
            </>
          )}
          <Button size="sm" onClick={() => startWeek()} disabled={starting}>
            {starting ? "Starting…" : "Start this week"}
          </Button>
        </div>
      </div>

      {weeks.length === 0 ? (
        <div className="border rounded-lg text-center py-16 text-muted-foreground text-sm">
          No timesheets yet — start this week to begin.
        </div>
      ) : (
        <div className="space-y-2">
          {weeks.map((w) => (
            <Link key={w.id} href={`/my-timesheets/${w.id}`}>
              <Card className="hover:bg-muted/40 transition-colors cursor-pointer">
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <p className="font-medium text-sm">Week of {w.week_starting}</p>
                    {w.status === "declined" && w.decline_reason && (
                      <p className="text-xs text-destructive mt-0.5">{w.decline_reason}</p>
                    )}
                  </div>
                  <Badge variant="outline" className={`text-xs ${STATUS_BADGE[w.status] ?? ""}`}>{w.status}</Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {templates.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Templates</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {templates.map((t) => (
              <Link key={t.id} href={`/my-timesheets/${t.id}`} className="flex items-center justify-between text-sm hover:underline">
                <span>Template saved {t.week_starting}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
