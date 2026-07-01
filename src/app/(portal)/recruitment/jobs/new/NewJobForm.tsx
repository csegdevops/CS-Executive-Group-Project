"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"

interface LookupValue { value: string; label: string }

interface Props {
  companies: { id: string; name: string }[]
  recruiters: { id: string; name: string }[]
  currentUserId: string
}

export function NewJobForm({ companies, recruiters, currentUserId }: Props) {
  const router = useRouter()
  const [saving, setSaving]             = useState(false)
  const [employmentTypes, setEmploymentTypes] = useState<LookupValue[]>([])

  useEffect(() => {
    fetch("/api/lookup-values?scope=recruitment&category=employment_type")
      .then(r => r.json())
      .then(d => setEmploymentTypes(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [])
  const [form, setForm] = useState({
    company_id: "",
    title: "",
    location: "",
    employment_type: "",
    vacancies_count: "1",
    salary_min: "",
    salary_max: "",
    security_clearance_required: false,
    assigned_recruiter_id: currentUserId,
    description: "",
    requirements: "",
  })

  function set(k: keyof typeof form, v: string | boolean) {
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
      if (form.location)              body.location = form.location
      if (form.employment_type)       body.employment_type = form.employment_type
      if (form.vacancies_count)       body.vacancies_count = parseInt(form.vacancies_count) || 1
      if (form.salary_min)            body.salary_min = parseFloat(form.salary_min)
      if (form.salary_max)            body.salary_max = parseFloat(form.salary_max)
      if (form.assigned_recruiter_id) body.assigned_recruiter_id = form.assigned_recruiter_id
      if (form.description)      body.description = form.description
      if (form.requirements)     body.requirements = form.requirements

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
      {/* Company */}
      <div className="space-y-1.5">
        <Label>Client company *</Label>
        <Select value={form.company_id} onValueChange={v => set("company_id", v)}>
          <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
          <SelectContent>
            {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Title */}
      <div className="space-y-1.5">
        <Label htmlFor="title">Job title *</Label>
        <Input id="title" value={form.title} onChange={e => set("title", e.target.value)} placeholder="e.g. Senior Program Manager" />
      </div>

      {/* Location */}
      <div className="space-y-1.5">
        <Label htmlFor="loc">Location</Label>
        <Input id="loc" value={form.location} onChange={e => set("location", e.target.value)} placeholder="e.g. Canberra, ACT" />
      </div>

      {/* Type + Vacancies */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Employment type</Label>
          <Select value={form.employment_type} onValueChange={v => set("employment_type", v)}>
            <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
            <SelectContent>
              {employmentTypes.map(et => (
                <SelectItem key={et.value} value={et.value}>{et.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vacancies">Vacancies</Label>
          <Input
            id="vacancies"
            type="number"
            min="1"
            value={form.vacancies_count}
            onChange={e => set("vacancies_count", e.target.value)}
          />
        </div>
      </div>

      {/* Recruiter */}
      <div className="space-y-1.5">
        <Label>Assigned recruiter</Label>
        <Select value={form.assigned_recruiter_id} onValueChange={v => set("assigned_recruiter_id", v)}>
          <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
          <SelectContent>
            {recruiters.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Salary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="sal-min">Salary min (AUD)</Label>
          <Input id="sal-min" type="number" value={form.salary_min} onChange={e => set("salary_min", e.target.value)} placeholder="120000" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sal-max">Salary max (AUD)</Label>
          <Input id="sal-max" type="number" value={form.salary_max} onChange={e => set("salary_max", e.target.value)} placeholder="150000" />
        </div>
      </div>

      {/* Security clearance */}
      <label className="flex items-center gap-2 cursor-pointer text-sm">
        <input
          type="checkbox"
          checked={form.security_clearance_required}
          onChange={e => set("security_clearance_required", e.target.checked)}
          className="h-4 w-4 rounded border-border"
        />
        Security clearance required
      </label>

      {/* Description */}
      <div className="space-y-1.5">
        <Label htmlFor="desc">Job description</Label>
        <textarea
          id="desc"
          rows={5}
          value={form.description}
          onChange={e => set("description", e.target.value)}
          placeholder="Role overview, responsibilities…"
          className="w-full text-sm rounded-md border border-border bg-background px-3 py-2 resize-y min-h-24 focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* Requirements */}
      <div className="space-y-1.5">
        <Label htmlFor="req">Requirements</Label>
        <textarea
          id="req"
          rows={4}
          value={form.requirements}
          onChange={e => set("requirements", e.target.value)}
          placeholder="Skills, qualifications, experience…"
          className="w-full text-sm rounded-md border border-border bg-background px-3 py-2 resize-y min-h-20 focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" disabled={saving || !form.company_id || !form.title}>
          {saving ? "Creating…" : "Create Job"}
        </Button>
      </div>
    </form>
  )
}
