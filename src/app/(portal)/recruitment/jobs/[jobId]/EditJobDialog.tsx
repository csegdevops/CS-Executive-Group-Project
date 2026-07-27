"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Pencil, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { JobFormFields, type JobFormState } from "../JobFormFields"

interface Props {
  jobId: string
  companies: { id: string; name: string }[]
  recruiters: { id: string; name: string }[]
  initial: {
    company_id: string
    title: string
    location: string | null
    employment_type: string | null
    vacancies_count: number
    salary_min: number | null
    salary_max: number | null
    contract_duration_weeks: number | null
    security_clearance_required: boolean
    assigned_recruiter_id: string | null
    description: string | null
    requirements: string | null
  }
}

function toFormState(initial: Props["initial"]): JobFormState {
  return {
    company_id: initial.company_id,
    title: initial.title,
    location: initial.location ?? "",
    employment_type: initial.employment_type ?? "",
    vacancies_count: String(initial.vacancies_count),
    salary_min: initial.salary_min != null ? String(initial.salary_min) : "",
    salary_max: initial.salary_max != null ? String(initial.salary_max) : "",
    contract_duration_weeks: initial.contract_duration_weeks != null ? String(initial.contract_duration_weeks) : "",
    security_clearance_required: initial.security_clearance_required,
    assigned_recruiter_id: initial.assigned_recruiter_id ?? "",
    description: initial.description ?? "",
    requirements: initial.requirements ?? "",
  }
}

export function EditJobDialog({ jobId, companies, recruiters, initial }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<JobFormState>(() => toFormState(initial))

  function set(k: keyof JobFormState, v: string | boolean) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.company_id || !form.title) { toast.error("Company and title are required"); return }
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        title: form.title,
        security_clearance_required: form.security_clearance_required,
        location: form.location || null,
        employment_type: form.employment_type || undefined,
        vacancies_count: parseInt(form.vacancies_count) || 1,
        salary_min: form.salary_min ? parseFloat(form.salary_min) : null,
        salary_max: form.salary_max ? parseFloat(form.salary_max) : null,
        contract_duration_weeks: form.contract_duration_weeks ? parseInt(form.contract_duration_weeks) : null,
        assigned_recruiter_id: form.assigned_recruiter_id || null,
        description: form.description || undefined,
        requirements: form.requirements || undefined,
      }

      const res = await fetch(`/api/recruitment/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? "Failed to update job")
        return
      }
      toast.success("Job updated")
      setOpen(false)
      router.refresh()
    } catch {
      toast.error("Network error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (next) setForm(toFormState(initial)); setOpen(next) }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit Job</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 mt-2">
          <JobFormFields form={form} set={set} companies={companies} recruiters={recruiters} companyDisabled />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving || !form.company_id || !form.title}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
