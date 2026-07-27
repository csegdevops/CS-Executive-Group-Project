"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export interface JobFormState {
  company_id: string
  title: string
  location: string
  employment_type: string
  vacancies_count: string
  salary_min: string
  salary_max: string
  contract_duration_weeks: string
  security_clearance_required: boolean
  assigned_recruiter_id: string
  description: string
  requirements: string
}

export const emptyJobForm: JobFormState = {
  company_id: "",
  title: "",
  location: "",
  employment_type: "",
  vacancies_count: "1",
  salary_min: "",
  salary_max: "",
  contract_duration_weeks: "",
  security_clearance_required: false,
  assigned_recruiter_id: "",
  description: "",
  requirements: "",
}

interface LookupValue { value: string; label: string }

interface Props {
  form: JobFormState
  set: (k: keyof JobFormState, v: string | boolean) => void
  companies: { id: string; name: string }[]
  recruiters: { id: string; name: string }[]
  /** The API doesn't support reassigning a job's client company after creation — disable the field rather than show a control that silently does nothing. */
  companyDisabled?: boolean
}

export function JobFormFields({ form, set, companies, recruiters, companyDisabled = false }: Props) {
  const [employmentTypes, setEmploymentTypes] = useState<LookupValue[]>([])

  useEffect(() => {
    fetch("/api/lookup-values?scope=recruitment&category=employment_type")
      .then(r => r.json())
      .then(d => setEmploymentTypes(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [])

  return (
    <>
      {/* Company */}
      <div className="space-y-1.5">
        <Label>Client company *</Label>
        <Select value={form.company_id} onValueChange={v => set("company_id", v)} disabled={companyDisabled}>
          <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
          <SelectContent>
            {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {companyDisabled && (
          <p className="text-xs text-muted-foreground">Client company can&apos;t be changed after a job is created.</p>
        )}
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

      {/* Salary + Contract duration */}
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="sal-min">Salary min (AUD)</Label>
          <Input id="sal-min" type="number" value={form.salary_min} onChange={e => set("salary_min", e.target.value)} placeholder="120000" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sal-max">Salary max (AUD)</Label>
          <Input id="sal-max" type="number" value={form.salary_max} onChange={e => set("salary_max", e.target.value)} placeholder="150000" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contract-weeks">Contract (weeks)</Label>
          <Input
            id="contract-weeks"
            type="number"
            min="1"
            value={form.contract_duration_weeks}
            onChange={e => set("contract_duration_weeks", e.target.value)}
            placeholder="e.g. 26"
          />
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
    </>
  )
}
