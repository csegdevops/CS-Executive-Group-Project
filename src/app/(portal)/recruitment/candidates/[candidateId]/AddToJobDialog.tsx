"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Plus, Search } from "lucide-react"
import { toast } from "sonner"

const NONE = "_none_"

const SOURCE_OPTIONS = [
  { value: "linkedin",          label: "LinkedIn" },
  { value: "seek_talent",       label: "Seek Talent Search" },
  { value: "database_internal", label: "Internal / Referral" },
  { value: "seek_inbound",      label: "Seek (inbound)" },
  { value: "company_website",   label: "Company Website" },
]

interface Job {
  id: string
  title: string
  reference_number: string | null
  company_name: string | null
  location: string | null
  status: string
}

export function AddToJobDialog({ candidateId }: { candidateId: string }) {
  const router = useRouter()
  const [open, setOpen]     = useState(false)
  const [saving, setSaving] = useState(false)
  const [jobs, setJobs]     = useState<Job[]>([])
  const [q, setQ]           = useState("")
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    job_id:         NONE,
    source_channel: NONE,
    notes:          "",
  })

  // Load active jobs when dialog opens, re-query when search changes
  useEffect(() => {
    if (!open) return
    setLoading(true)
    const params = new URLSearchParams({ status: "active,posted,opened" })
    if (q.trim()) params.set("q", q.trim())
    fetch(`/api/recruitment/jobs?${params}`)
      .then(r => r.json())
      .then(d => setJobs(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open, q])

  function reset() {
    setForm({ job_id: NONE, source_channel: NONE, notes: "" })
    setQ("")
  }

  async function handleSubmit() {
    if (form.job_id === NONE || form.source_channel === NONE) return
    setSaving(true)
    try {
      const res = await fetch("/api/recruitment/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidate_id:   candidateId,
          job_id:         form.job_id,
          source_channel: form.source_channel,
          notes:          form.notes.trim() || undefined,
        }),
      })
      const result = await res.json()
      if (!res.ok) {
        toast.error(result.error ?? "Failed to create application")
        return
      }
      if (result.status === "duplicate_skipped") {
        toast.info("This candidate already has an application for that job")
      } else {
        toast.success("Application created — stage: Applied")
      }
      setOpen(false)
      reset()
      router.refresh()
    } finally { setSaving(false) }
  }

  const canSubmit = form.job_id !== NONE && form.source_channel !== NONE

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="gap-1.5">
        <Plus className="h-3.5 w-3.5" />Add to Job
      </Button>

      <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) reset() }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add to job</DialogTitle></DialogHeader>

          <div className="space-y-4 py-1">
            {/* Job search */}
            <div className="space-y-1.5">
              <Label>Job *</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={e => { setQ(e.target.value); setForm(f => ({ ...f, job_id: NONE })) }}
                  placeholder="Search job title…"
                  className="pl-8"
                />
              </div>

              {loading && <p className="text-xs text-muted-foreground">Loading…</p>}

              {!loading && jobs.length === 0 && (
                <p className="text-xs text-muted-foreground">No active jobs{q ? ` matching "${q}"` : ""}.</p>
              )}

              {!loading && jobs.length > 0 && (
                <div className="border rounded-md overflow-hidden max-h-52 overflow-y-auto">
                  {jobs.map(j => (
                    <button
                      key={j.id}
                      type="button"
                      onClick={() => { setForm(f => ({ ...f, job_id: j.id })); setQ(`${j.title}${j.company_name ? ` — ${j.company_name}` : ""}`) }}
                      className={`w-full text-left px-3 py-2.5 text-sm transition-colors border-b last:border-b-0 ${
                        form.job_id === j.id ? "bg-primary/10 font-medium" : "hover:bg-muted/40"
                      }`}
                    >
                      <p className="font-medium">{j.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {[j.company_name, j.location, j.reference_number].filter(Boolean).join(" · ")}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Source channel — mandatory per application */}
            <div className="space-y-1.5">
              <Label>How they applied *</Label>
              <Select value={form.source_channel} onValueChange={v => setForm(f => ({ ...f, source_channel: v }))}>
                <SelectTrigger><SelectValue placeholder="Select channel…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE} disabled>Select channel…</SelectItem>
                  {SOURCE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <textarea
                rows={2}
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="e.g. Strong referral from John at Defence"
                className="w-full text-sm rounded-md border border-border bg-background px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); reset() }}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!canSubmit || saving}>
              {saving ? "Creating…" : "Create Application"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
