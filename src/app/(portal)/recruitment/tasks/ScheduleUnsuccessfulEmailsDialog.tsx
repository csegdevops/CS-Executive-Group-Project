"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog"
import { Mail } from "lucide-react"
import { toast } from "sonner"

interface Candidate {
  application_id: string
  candidate_id: string
  candidate_name: string
  candidate_email: string | null
  stage: string
  already_scheduled: boolean
  scheduled_for: string | null
}

interface Props {
  taskId: string
  jobId: string
  jobTitle: string | null
  onScheduled: () => void
}

const today = new Date().toISOString().slice(0, 10)

export function ScheduleUnsuccessfulEmailsDialog({ taskId, jobId, jobTitle, onScheduled }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [scheduledFor, setScheduledFor] = useState(today)

  async function handleOpen(next: boolean) {
    setOpen(next)
    if (!next) return
    setLoading(true)
    try {
      const res = await fetch(`/api/recruitment/jobs/${jobId}/unsuccessful-candidates`)
      if (!res.ok) { toast.error("Failed to load candidates"); return }
      const data = await res.json()
      const list: Candidate[] = data.candidates ?? []
      setCandidates(list)
      setSelected(new Set(list.filter((c) => !c.already_scheduled).map((c) => c.application_id)))
    } finally {
      setLoading(false)
    }
  }

  function toggle(appId: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(appId)
      else next.delete(appId)
      return next
    })
  }

  async function handleSubmit() {
    if (selected.size === 0) return
    setSaving(true)
    try {
      const res = await fetch(`/api/recruitment/jobs/${jobId}/schedule-unsuccessful-emails`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          application_ids: Array.from(selected),
          scheduled_for: scheduledFor,
          task_id: taskId,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(typeof body.error === "string" ? body.error : "Failed to schedule emails")
      }
      toast.success("Emails scheduled")
      setOpen(false)
      onScheduled()
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to schedule emails")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-6 text-xs px-2 gap-1">
          <Mail className="h-3 w-3" />Schedule emails
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Schedule unsuccessful-candidate emails{jobTitle ? ` — ${jobTitle}` : ""}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground py-4">Loading candidates…</p>
        ) : candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No remaining applicants for this job.</p>
        ) : (
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label>Send on</Label>
              <Input type="date" min={today} value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label>Recipients</Label>
              <div className="rounded-md border divide-y max-h-64 overflow-y-auto">
                {candidates.map((c) => (
                  <label
                    key={c.application_id}
                    className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-muted/30"
                  >
                    <Checkbox
                      checked={selected.has(c.application_id)}
                      disabled={c.already_scheduled}
                      onCheckedChange={(v) => toggle(c.application_id, v === true)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="truncate">{c.candidate_name}</p>
                      {c.already_scheduled && (
                        <p className="text-xs text-muted-foreground">Already scheduled for {c.scheduled_for}</p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={selected.size === 0 || saving || loading}>
            {saving ? "Scheduling…" : `Schedule ${selected.size || ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
