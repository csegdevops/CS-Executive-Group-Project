"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Pencil } from "lucide-react"
import { toast } from "sonner"

const PERM_CONVERSION_OPTIONS = [
  { value: "not_notified", label: "Not Notified Yet" },
  { value: "notified", label: "Notified" },
  { value: "converted", label: "Converted" },
  { value: "declined", label: "Declined" },
  { value: "not_applicable", label: "Not Applicable" },
]

export interface ContractDetails {
  contract_number: string | null
  notice_period: string | null
  position_title: string | null
  safety_course_required: boolean
  view_to_extend: boolean
  permanent_conversion_status: string
  next_award_review_date: string | null
  reporting_contact_name: string | null
  reporting_contact_email: string | null
  work_attire_ppe: string | null
  actual_finish_date: string | null
  last_payment_date: string | null
}

export function EditContractDetailsDialog({
  contractId, details, onSaved,
}: {
  contractId: string
  details: ContractDetails
  onSaved?: () => void
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [number, setNumber] = useState(details.contract_number ?? "")
  const [notice, setNotice] = useState(details.notice_period ?? "")
  const [positionTitle, setPositionTitle] = useState(details.position_title ?? "")
  const [safetyCourseRequired, setSafetyCourseRequired] = useState(details.safety_course_required)
  const [viewToExtend, setViewToExtend] = useState(details.view_to_extend)
  const [permConversion, setPermConversion] = useState(details.permanent_conversion_status)
  const [nextAwardReview, setNextAwardReview] = useState(details.next_award_review_date ?? "")
  const [reportingName, setReportingName] = useState(details.reporting_contact_name ?? "")
  const [reportingEmail, setReportingEmail] = useState(details.reporting_contact_email ?? "")
  const [attirePpe, setAttirePpe] = useState(details.work_attire_ppe ?? "")
  const [actualFinishDate, setActualFinishDate] = useState(details.actual_finish_date ?? "")
  const [lastPaymentDate, setLastPaymentDate] = useState(details.last_payment_date ?? "")
  const [saving, setSaving] = useState(false)

  async function handleSubmit() {
    setSaving(true)
    try {
      const res = await fetch(`/api/recruitment/contracts/${contractId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contract_number: number || null,
          notice_period: notice || null,
          position_title: positionTitle || null,
          safety_course_required: safetyCourseRequired,
          view_to_extend: viewToExtend,
          permanent_conversion_status: permConversion,
          next_award_review_date: nextAwardReview || null,
          reporting_contact_name: reportingName || null,
          reporting_contact_email: reportingEmail || null,
          work_attire_ppe: attirePpe || null,
          actual_finish_date: actualFinishDate || null,
          last_payment_date: lastPaymentDate || null,
        }),
      })
      if (!res.ok) { toast.error("Failed to save"); return }
      toast.success("Contract details updated")
      setOpen(false)
      router.refresh()
      onSaved?.()
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setOpen(true)}>
        <Pencil className="h-3.5 w-3.5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Contract details</DialogTitle></DialogHeader>
          <div className="max-h-[65vh] overflow-y-auto pr-1 space-y-3 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Contract number</Label>
                <Input value={number} onChange={(e) => setNumber(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Position title</Label>
                <Input value={positionTitle} onChange={(e) => setPositionTitle(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notice period</Label>
              <textarea
                value={notice}
                onChange={(e) => setNotice(e.target.value)}
                rows={2}
                placeholder="e.g. 4 weeks written notice by either party"
                className="w-full text-sm rounded-md border border-border bg-background px-2.5 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Permanent conversion</Label>
                <Select value={permConversion} onValueChange={setPermConversion}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PERM_CONVERSION_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Next award review date</Label>
                <Input type="date" value={nextAwardReview} onChange={(e) => setNextAwardReview(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Actual finish date</Label>
                <Input type="date" value={actualFinishDate} onChange={(e) => setActualFinishDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Last payment date</Label>
                <Input type="date" value={lastPaymentDate} onChange={(e) => setLastPaymentDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>First-day reporting contact — name</Label>
                <Input value={reportingName} onChange={(e) => setReportingName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>First-day reporting contact — email</Label>
                <Input type="email" value={reportingEmail} onChange={(e) => setReportingEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Work attire & PPE</Label>
                <Input value={attirePpe} onChange={(e) => setAttirePpe(e.target.value)} />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 text-sm">
                <Checkbox checked={safetyCourseRequired} onCheckedChange={(c) => setSafetyCourseRequired(!!c)} />Safety course required
              </label>
              <label className="flex items-center gap-1.5 text-sm">
                <Checkbox checked={viewToExtend} onCheckedChange={(c) => setViewToExtend(!!c)} />View to extend
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
