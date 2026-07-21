"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { CandidateLocationAutocomplete, type CandidateLocation } from "./CandidateLocationAutocomplete"
import { Pencil, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface LookupValue { value: string; label: string }

// Radix SelectItem rejects an empty string value — use a sentinel instead
const NONE = "_none_"
const NO_CLEARANCE = "none"

interface Initial {
  first_name: string
  last_name: string
  email: string
  secondary_email: string
  phone: string
  current_title: string
  current_employer: string
  employment_status: "employed" | "not_working"
  location_city: string
  location_state: string
  location_postcode: string
  field_of_study: string
  citizenship_status: string
  security_clearance_level: string
  security_clearance_verified: boolean
  security_clearance_expiry: string
}

export function EditCandidateDialog({
  candidateId,
  initial,
}: {
  candidateId: string
  initial: Initial
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [clearanceOptions, setClearanceOptions] = useState<LookupValue[]>([])
  const [citizenshipOptions, setCitizenshipOptions] = useState<LookupValue[]>([])

  const [firstName, setFirstName]   = useState(initial.first_name)
  const [lastName, setLastName]     = useState(initial.last_name)
  const [email, setEmail]           = useState(initial.email)
  const [secondaryEmail, setSecondaryEmail] = useState(initial.secondary_email)
  const [phone, setPhone]           = useState(initial.phone)
  const [title, setTitle]           = useState(initial.current_title)
  const [employer, setEmployer]     = useState(initial.current_employer)
  const [employmentStatus, setEmploymentStatus] = useState(initial.employment_status)
  const [location, setLocation] = useState<CandidateLocation>({
    city: initial.location_city,
    state: initial.location_state,
    postcode: initial.location_postcode,
  })
  const [fieldOfStudy, setFieldOfStudy] = useState(initial.field_of_study)
  const [citizenshipStatus, setCitizenshipStatus] = useState(initial.citizenship_status || NONE)
  const [clearanceLevel, setClearanceLevel] = useState(initial.security_clearance_level || NO_CLEARANCE)
  const [clearanceVerified, setClearanceVerified] = useState(initial.security_clearance_verified)
  const [clearanceExpiry, setClearanceExpiry] = useState(initial.security_clearance_expiry)

  useEffect(() => {
    if (!open) return
    fetch("/api/lookup-values?scope=global&category=security_clearance_level")
      .then((r) => r.json())
      .then((d) => setClearanceOptions(Array.isArray(d) ? d : []))
      .catch(() => {})
    fetch("/api/lookup-values?scope=recruitment&category=citizenship_status")
      .then((r) => r.json())
      .then((d) => setCitizenshipOptions(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [open])

  const hasClearance = clearanceLevel !== NO_CLEARANCE

  async function handleSave() {
    if (!firstName.trim() || !lastName.trim()) { toast.error("First and last name are required"); return }
    if (!email.trim()) { toast.error("Email is required"); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/recruitment/candidates/${candidateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim().toLowerCase(),
          secondary_email: secondaryEmail.trim() ? secondaryEmail.trim().toLowerCase() : null,
          phone: phone || null,
          current_title: title || null,
          current_employer: employer || null,
          employment_status: employmentStatus,
          location_city: location.city || null,
          location_state: location.state || null,
          location_postcode: location.postcode || null,
          field_of_study: fieldOfStudy || null,
          citizenship_status: citizenshipStatus === NONE ? null : citizenshipStatus,
          security_clearance_level: clearanceLevel === NO_CLEARANCE ? "none" : clearanceLevel,
          security_clearance_verified: hasClearance ? clearanceVerified : false,
          security_clearance_expiry: hasClearance ? (clearanceExpiry || null) : null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? "Save failed")
        return
      }
      toast.success("Details saved")
      setOpen(false)
      router.refresh()
    } catch {
      toast.error("Network error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-muted-foreground">
          <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Candidate Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1">First Name *</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1">Last Name *</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>

          <div>
            <Label className="mb-1">Email *</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="work@company.com" />
          </div>

          <div>
            <Label className="mb-1">Secondary Email</Label>
            <Input type="email" value={secondaryEmail} onChange={(e) => setSecondaryEmail(e.target.value)} placeholder="personal@email.com" />
          </div>

          <div>
            <Label className="mb-1">Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 04XX XXX XXX" />
          </div>

          <div className="border-t pt-4 space-y-3">
            <div>
              <Label className="mb-1">Employment Status</Label>
              <Select value={employmentStatus} onValueChange={(v) => setEmploymentStatus(v as "employed" | "not_working")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="employed">Currently employed</SelectItem>
                  <SelectItem value="not_working">Not currently working</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-1">{employmentStatus === "not_working" ? "Last Title" : "Current Title"}</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Senior Consultant" />
            </div>

            <div>
              <Label className="mb-1">{employmentStatus === "not_working" ? "Last Employer" : "Current Employer"}</Label>
              <Input value={employer} onChange={(e) => setEmployer(e.target.value)} />
            </div>
          </div>

          <div className="border-t pt-4">
            <CandidateLocationAutocomplete value={location} onChange={setLocation} />
          </div>

          <div>
            <Label className="mb-1">Field of Study</Label>
            <Input value={fieldOfStudy} onChange={(e) => setFieldOfStudy(e.target.value)} />
          </div>

          <div>
            <Label className="mb-1">Citizenship / Work Rights</Label>
            <Select value={citizenshipStatus} onValueChange={setCitizenshipStatus}>
              <SelectTrigger><SelectValue placeholder="Not specified" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Not specified</SelectItem>
                {citizenshipOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="border-t pt-4">
            <Label className="mb-1">Security Clearance</Label>
            <Select value={clearanceLevel} onValueChange={setClearanceLevel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {clearanceOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasClearance && (
              <>
                <label className="flex items-center gap-1.5 text-sm cursor-pointer mt-2">
                  <input
                    type="checkbox"
                    checked={clearanceVerified}
                    onChange={(e) => setClearanceVerified(e.target.checked)}
                    className="rounded"
                  />
                  Verified
                </label>

                <Label className="mb-1 mt-2">Clearance Expiry</Label>
                <Input type="date" value={clearanceExpiry} onChange={(e) => setClearanceExpiry(e.target.value)} />
              </>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
