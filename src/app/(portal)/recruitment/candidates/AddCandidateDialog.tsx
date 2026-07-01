"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Plus } from "lucide-react"
import { toast } from "sonner"

const NONE = "_none_"

const SOURCE_OPTIONS = [
  { value: "linkedin",          label: "LinkedIn" },
  { value: "seek_talent",       label: "Seek Talent Search" },
  { value: "database_internal", label: "Internal / Referral" },
  { value: "seek_inbound",      label: "Seek (inbound)" },
  { value: "company_website",   label: "Company Website" },
]

const CLEARANCE_OPTIONS = [
  { value: "baseline", label: "Baseline" },
  { value: "nv1",      label: "NV1" },
  { value: "nv2",      label: "NV2" },
  { value: "pv",       label: "PV" },
  { value: "tsc",      label: "TSC" },
]

interface SkillLookup { value: string; label: string }

interface Props {
  onAdded?: (action: "inserted" | "collision_merged") => void
}

export function AddCandidateDialog({ onAdded }: Props) {
  const [open, setOpen]       = useState(false)
  const [saving, setSaving]   = useState(false)
  const [skills, setSkills]   = useState<SkillLookup[]>([])

  const [form, setForm] = useState({
    first_name:               "",
    last_name:                "",
    email:                    "",
    phone:                    "",
    current_title:            "",
    current_employer:         "",
    location_city:            "",
    location_state:           "",
    field_of_study:           "",
    source_channel:           NONE,
    security_clearance_level: NONE,
  })
  const [selectedSkills, setSelectedSkills] = useState<string[]>([])

  useEffect(() => {
    if (!open) return
    fetch("/api/lookup-values?scope=recruitment&category=skill_tag")
      .then(r => r.json())
      .then(d => setSkills(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [open])

  function setF(k: keyof typeof form, v: string) {
    setForm(f => ({ ...f, [k]: v }))
  }

  function toggleSkill(val: string) {
    setSelectedSkills(prev =>
      prev.includes(val) ? prev.filter(s => s !== val) : [...prev, val]
    )
  }

  function reset() {
    setForm({
      first_name: "", last_name: "", email: "", phone: "",
      current_title: "", current_employer: "",
      location_city: "", location_state: "",
      field_of_study: "",
      source_channel: NONE,
      security_clearance_level: NONE,
    })
    setSelectedSkills([])
  }

  async function handleSubmit() {
    if (!form.first_name.trim() || !form.last_name.trim() || !form.email.trim()) return
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        first_name:    form.first_name.trim(),
        last_name:     form.last_name.trim(),
        email:         form.email.trim().toLowerCase(),
        phone:         form.phone.trim() || undefined,
        current_title:    form.current_title.trim()    || undefined,
        current_employer: form.current_employer.trim() || undefined,
        location_city:    form.location_city.trim()    || undefined,
        location_state:   form.location_state.trim()   || undefined,
        field_of_study:   form.field_of_study.trim()   || undefined,
        source_channel:   form.source_channel === NONE ? undefined : form.source_channel,
        security_clearance_level: form.security_clearance_level === NONE ? undefined : form.security_clearance_level,
      }
      if (selectedSkills.length) body.skills_tags = selectedSkills

      const res = await fetch("/api/recruitment/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error ?? "Failed to add candidate")
        return
      }
      const result = await res.json()
      const action = result.action as "inserted" | "collision_merged"
      toast.success(
        action === "inserted"
          ? `${form.first_name} ${form.last_name} added to talent pool`
          : `Merged with existing record for ${form.email}`
      )
      setOpen(false)
      reset()
      onAdded?.(action)
    } finally { setSaving(false) }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5">
        <Plus className="h-4 w-4" />Add Candidate
      </Button>

      <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) reset() }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add candidate</DialogTitle></DialogHeader>

          <div className="space-y-4 py-1">
            {/* Name */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>First name *</Label>
                <Input value={form.first_name} onChange={e => setF("first_name", e.target.value)} autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label>Last name *</Label>
                <Input value={form.last_name} onChange={e => setF("last_name", e.target.value)} />
              </div>
            </div>

            {/* Contact */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Email *</Label>
                <Input type="email" value={form.email} onChange={e => setF("email", e.target.value)} placeholder="name@company.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={e => setF("phone", e.target.value)} placeholder="04XX XXX XXX" />
              </div>
            </div>

            {/* Role */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Current title</Label>
                <Input value={form.current_title} onChange={e => setF("current_title", e.target.value)} placeholder="e.g. Project Manager" />
              </div>
              <div className="space-y-1.5">
                <Label>Current employer</Label>
                <Input value={form.current_employer} onChange={e => setF("current_employer", e.target.value)} />
              </div>
            </div>

            {/* Location */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>City</Label>
                <Input value={form.location_city} onChange={e => setF("location_city", e.target.value)} placeholder="e.g. Canberra" />
              </div>
              <div className="space-y-1.5">
                <Label>State</Label>
                <Input value={form.location_state} onChange={e => setF("location_state", e.target.value)} placeholder="e.g. ACT" />
              </div>
            </div>

            {/* Field of study */}
            <div className="space-y-1.5">
              <Label>Field of study</Label>
              <Input
                value={form.field_of_study}
                onChange={e => setF("field_of_study", e.target.value)}
                placeholder="e.g. Bachelor of Engineering (Mechatronics)"
              />
            </div>

            {/* Source + Clearance */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Where found</Label>
                <Select value={form.source_channel} onValueChange={v => setF("source_channel", v)}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Unknown</SelectItem>
                    {SOURCE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Security clearance</Label>
                <Select value={form.security_clearance_level} onValueChange={v => setF("security_clearance_level", v)}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    {CLEARANCE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Skills */}
            {skills.length > 0 && (
              <div className="space-y-2">
                <Label>Skills</Label>
                <div className="flex flex-wrap gap-1.5">
                  {skills.map(s => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => toggleSkill(s.value)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                        selectedSkills.includes(s.value)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-muted-foreground border-border hover:border-foreground/40"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                {selectedSkills.length > 0 && (
                  <p className="text-xs text-muted-foreground">{selectedSkills.length} selected</p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); reset() }}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={!form.first_name.trim() || !form.last_name.trim() || !form.email.trim() || saving}
            >
              {saving ? "Adding…" : "Add Candidate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
