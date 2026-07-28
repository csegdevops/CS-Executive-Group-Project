"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { JobFormFields, emptyJobForm, type JobFormState } from "../JobFormFields"

interface Props {
  companies: { id: string; name: string }[]
  recruiters: { id: string; name: string }[]
  currentUserId: string
}

export function NewJobForm({ companies, recruiters, currentUserId }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<JobFormState>({ ...emptyJobForm, assigned_recruiter_id: currentUserId })

  function set(k: keyof JobFormState, v: string | boolean | string[]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.company_id || !form.title) { toast.error("Company and title are required"); return }
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        company_id: form.company_id,
        title: form.title,
        security_clearance_required: form.security_clearance_required,
      }
      if (form.reference_number)         body.reference_number = form.reference_number
      if (form.location)                 body.location = form.location
      if (form.employment_type)          body.employment_type = form.employment_type
      if (form.vacancies_count)          body.vacancies_count = parseInt(form.vacancies_count) || 1
      if (form.salary_min)               body.salary_min = parseFloat(form.salary_min)
      if (form.salary_max)               body.salary_max = parseFloat(form.salary_max)
      if (form.contract_duration_weeks)  body.contract_duration_weeks = parseInt(form.contract_duration_weeks) || undefined
      if (form.assigned_recruiter_id)    body.assigned_recruiter_id = form.assigned_recruiter_id
      if (form.description)      body.description = form.description
      if (form.requirements)     body.requirements = form.requirements
      body.required_skills = form.required_skills
      body.required_education_tags = form.required_education_tags

      const res = await fetch("/api/recruitment/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? "Failed to create job")
        return
      }
      const job = await res.json()
      toast.success("Job created")
      router.push(`/recruitment/jobs/${job.id}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 bg-card border rounded-lg p-6">
      <JobFormFields form={form} set={set} companies={companies} recruiters={recruiters} />

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" disabled={saving || !form.company_id || !form.title}>
          {saving ? "Creating…" : "Create Job"}
        </Button>
      </div>
    </form>
  )
}
