"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface Candidate {
  applicationId: string
  candidateId: string
  candidateName: string
}

interface Props {
  jobId: string
  candidates: Candidate[]
  onOpenChange: (open: boolean) => void
  onDone: () => void
}

interface JobInfo {
  title: string
  company_name: string | null
  employment_type: string | null
  vacancies_count: number | null
  placed_count: number
}

interface FormState {
  start_date: string
  finish_date: string
}

function emptyForm(): FormState {
  return { start_date: "", finish_date: "" }
}

// A multi-candidate version of CreatePlacementDialog: fills in a start/finish
// date for several candidates against the same job's vacancies before
// submitting them all together. Placement type isn't a choice here — it's
// fixed by the job's employment_type, same as the single-candidate dialog.
// Nothing is created until "Create placements" on the last step; you can go
// back and forth between candidates freely while filling this in.
export function BulkCreatePlacementsDialog({ jobId, candidates, onOpenChange, onDone }: Props) {
  const router = useRouter()
  const [jobInfo, setJobInfo] = useState<JobInfo | null>(null)
  const [step, setStep] = useState(0)
  const [forms, setForms] = useState<Record<string, FormState>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/recruitment/jobs/${jobId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((job) => {
        setJobInfo(job)
        setForms(Object.fromEntries(candidates.map((c) => [c.applicationId, emptyForm()])))
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId])

  const placementType: "permanent" | "contract" = jobInfo?.employment_type === "contract" ? "contract" : "permanent"
  const remaining = jobInfo ? (jobInfo.vacancies_count ?? 1) - jobInfo.placed_count : undefined
  const tooManySelected = remaining !== undefined && candidates.length > remaining

  const current = candidates[step]
  const form = current ? forms[current.applicationId] : undefined

  function set(k: keyof FormState, v: string) {
    if (!current) return
    setForms((prev) => ({ ...prev, [current.applicationId]: { ...prev[current.applicationId], [k]: v } }))
  }

  const filledCount = candidates.filter((c) => forms[c.applicationId]?.start_date).length

  async function handleSubmit() {
    if (tooManySelected) {
      toast.error(`Too many selected — only ${remaining} vacanc${remaining === 1 ? "y" : "ies"} remaining for this job`)
      return
    }
    const toCreate = candidates.filter((c) => forms[c.applicationId]?.start_date)
    if (toCreate.length === 0) {
      toast.error("Enter a start date for at least one candidate")
      return
    }
    setSaving(true)
    try {
      const results = await Promise.all(
        toCreate.map((c) => {
          const f = forms[c.applicationId]
          return fetch("/api/recruitment/placements", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              application_id: c.applicationId,
              job_id: jobId,
              candidate_id: c.candidateId,
              placement_type: placementType,
              start_date: f.start_date,
              finish_date: f.finish_date || null,
            }),
          }).then((res) => res.ok)
        })
      )
      const failed = results.filter((ok) => !ok).length
      if (failed > 0) toast.error(`${failed} of ${toCreate.length} placements failed`)
      else toast.success(`Created ${toCreate.length} placement${toCreate.length !== 1 ? "s" : ""}`)
      onOpenChange(false)
      onDone()
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create placements — candidate {step + 1} of {candidates.length}</DialogTitle>
        </DialogHeader>

        {!jobInfo || !current || !form ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <div className="rounded-md border bg-muted/30 p-3 space-y-1">
              <p className="text-sm font-medium">{jobInfo.title}</p>
              {jobInfo.company_name && <p className="text-xs text-muted-foreground">{jobInfo.company_name}</p>}
              <Badge variant="outline" className="mt-1 text-xs">
                {placementType === "contract" ? "Contract / Temporary" : "Permanent"}
              </Badge>
            </div>

            {tooManySelected && (
              <p className="text-xs text-destructive">
                Too many selected — only {remaining} vacanc{remaining === 1 ? "y" : "ies"} remaining for this job. Remove candidates or go back and select fewer.
              </p>
            )}

            <div className="flex items-center justify-between">
              <Button variant="outline" size="icon" className="h-7 w-7" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <p className="text-sm font-medium truncate px-2">{current.candidateName}</p>
              <Button variant="outline" size="icon" className="h-7 w-7" disabled={step === candidates.length - 1} onClick={() => setStep((s) => s + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-3 py-1">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Start date</Label>
                  <Input type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} autoFocus />
                </div>
                <div className="space-y-1.5">
                  <Label>Finish date</Label>
                  <Input type="date" value={form.finish_date} onChange={(e) => set("finish_date", e.target.value)} />
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Nothing is saved until you click &quot;Create placements&quot; below — fill in what you have and move between candidates freely. Only a start date is required per candidate.
              </p>
            </div>
          </>
        )}

        <DialogFooter className="flex-row items-center justify-between sm:justify-between">
          <span className="text-xs text-muted-foreground">{filledCount} of {candidates.length} ready</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={saving || filledCount === 0 || tooManySelected}>
              {saving ? "Creating…" : `Create placement${filledCount !== 1 ? "s" : ""}`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
