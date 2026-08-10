"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { WorkScheduleFields, normalizeWorkingHours, type WorkHourEntry } from "./WorkScheduleFields"
import { AwardFields } from "./AwardFields"
import { RefreshCw } from "lucide-react"
import { toast } from "sonner"

// Suggests the next renewal suffix: "GER.06BB5-2" -> "GER.06BB5-3",
// "GER.06BB5" (no suffix yet) -> "GER.06BB5-2". Falls back to the job's own
// reference number if this contract never got a number in the first place.
function suggestNextContractNumber(current: string | null, jobReferenceNumber: string | null): string {
  const base = current || jobReferenceNumber
  if (!base) return ""
  const m = base.match(/^(.*)-(\d+)$/)
  if (m) return `${m[1]}-${Number(m[2]) + 1}`
  return `${base}-2`
}

export interface CurrentContractForRenewal {
  id: string
  contract_number: string | null
  notice_period: string | null
  finish_date: string | null
  pay_rate: number | null
  charge_rate: number | null
  currency: string | null
  factor_rate: number | null
  pay_rate_excl_casual_loading: number | null
  award: string | null
  award_level: string | null
  payment_terms_days: number | null
  overtime_applicable: boolean
  po_required: boolean
  position_title: string | null
  safety_course_required: boolean
  view_to_extend: boolean
  permanent_conversion_status: string
  next_award_review_date: string | null
  reporting_contact_name: string | null
  reporting_contact_email: string | null
  work_attire_ppe: string | null
  working_hours: WorkHourEntry[] | null
  lunch_break_minutes: number | null
  start_time_first_day: string | null
  job_reference_number: string | null
  job_title: string | null
}

const PERM_CONVERSION_OPTIONS = [
  { value: "not_notified", label: "Not Notified Yet" },
  { value: "notified", label: "Notified" },
  { value: "converted", label: "Converted" },
  { value: "declined", label: "Declined" },
  { value: "not_applicable", label: "Not Applicable" },
]

export function RenewContractDialog({
  contract, onRenewed,
}: {
  contract: CurrentContractForRenewal
  /** When provided (e.g. from ContractDetailSheet), called with the new
   * contract's id instead of navigating to its full page — lets the caller
   * switch the sheet to show the new contract in place. */
  onRenewed?: (newContractId: string) => void
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [contractNumber, setContractNumber] = useState(suggestNextContractNumber(contract.contract_number, contract.job_reference_number))
  const [noticePeriod, setNoticePeriod] = useState(contract.notice_period ?? "")
  const [startDate, setStartDate] = useState(
    contract.finish_date ? new Date(new Date(contract.finish_date).getTime() + 86400000).toISOString().slice(0, 10) : ""
  )
  const [finishDate, setFinishDate] = useState("")
  const [payRate, setPayRate] = useState(contract.pay_rate != null ? String(contract.pay_rate) : "")
  const [chargeRate, setChargeRate] = useState(contract.charge_rate != null ? String(contract.charge_rate) : "")
  const [factorRate, setFactorRate] = useState(contract.factor_rate != null ? String(contract.factor_rate) : "")
  const [payRateExclLoading, setPayRateExclLoading] = useState(
    contract.pay_rate_excl_casual_loading != null ? String(contract.pay_rate_excl_casual_loading) : ""
  )
  const [award, setAward] = useState(contract.award ?? "")
  const [awardLevel, setAwardLevel] = useState(contract.award_level ?? "")
  const [paymentTermsDays, setPaymentTermsDays] = useState(contract.payment_terms_days != null ? String(contract.payment_terms_days) : "")
  const [overtimeApplicable, setOvertimeApplicable] = useState(contract.overtime_applicable)
  const [poRequired, setPoRequired] = useState(contract.po_required)
  const [positionTitle, setPositionTitle] = useState(contract.position_title ?? contract.job_title ?? "")
  const [safetyCourseRequired, setSafetyCourseRequired] = useState(contract.safety_course_required)
  const [viewToExtend, setViewToExtend] = useState(contract.view_to_extend)
  const [permConversion, setPermConversion] = useState(contract.permanent_conversion_status)
  const [nextAwardReview, setNextAwardReview] = useState(contract.next_award_review_date ?? "")
  const [reportingName, setReportingName] = useState(contract.reporting_contact_name ?? "")
  const [reportingEmail, setReportingEmail] = useState(contract.reporting_contact_email ?? "")
  const [attirePpe, setAttirePpe] = useState(contract.work_attire_ppe ?? "")
  const [workingHours, setWorkingHours] = useState<WorkHourEntry[]>(normalizeWorkingHours(contract.working_hours))
  const [lunchBreak, setLunchBreak] = useState(contract.lunch_break_minutes != null ? String(contract.lunch_break_minutes) : "")
  const [startTimeFirstDay, setStartTimeFirstDay] = useState(contract.start_time_first_day ?? "")

  async function handleSubmit() {
    if (!startDate) return
    setSaving(true)
    try {
      const res = await fetch(`/api/recruitment/contracts/${contract.id}/renew`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contract_number: contractNumber || null,
          notice_period: noticePeriod || null,
          start_date: startDate,
          finish_date: finishDate || null,
          pay_rate: payRate ? Number(payRate) : null,
          charge_rate: chargeRate ? Number(chargeRate) : null,
          currency: contract.currency ?? "AUD",
          factor_rate: factorRate ? Number(factorRate) : null,
          pay_rate_excl_casual_loading: payRateExclLoading ? Number(payRateExclLoading) : null,
          award: award || null,
          award_level: awardLevel || null,
          payment_terms_days: paymentTermsDays ? Number(paymentTermsDays) : null,
          overtime_applicable: overtimeApplicable,
          po_required: poRequired,
          position_title: positionTitle || null,
          safety_course_required: safetyCourseRequired,
          view_to_extend: viewToExtend,
          permanent_conversion_status: permConversion,
          next_award_review_date: nextAwardReview || null,
          reporting_contact_name: reportingName || null,
          reporting_contact_email: reportingEmail || null,
          work_attire_ppe: attirePpe || null,
          working_hours: workingHours,
          lunch_break_minutes: lunchBreak ? Number(lunchBreak) : null,
          start_time_first_day: startTimeFirstDay || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(typeof err?.error === "string" ? err.error : "Failed to renew contract")
      }
      const result = await res.json()
      toast.success("Contract renewed")
      setOpen(false)
      if (onRenewed) {
        onRenewed(result.contract_id)
      } else {
        router.push(`/recruitment/contractors/${result.contract_id}`)
      }
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to renew contract")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" className="w-full gap-1.5" onClick={() => setOpen(true)}>
        <RefreshCw className="h-3.5 w-3.5" />Renew contract
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Renew contract</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">
            Creates a new contract record. Rate, award, and terms can differ from the current contract — anything
            left as-is below carries over unchanged.
          </p>
          <div className="max-h-[65vh] overflow-y-auto pr-1 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Contract number</Label>
                <Input value={contractNumber} onChange={(e) => setContractNumber(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Notice period</Label>
                <Input value={noticePeriod} onChange={(e) => setNoticePeriod(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Start date *</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Finish date</Label>
                <Input type="date" value={finishDate} onChange={(e) => setFinishDate(e.target.value)} />
              </div>
            </div>

            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Rate & terms of business</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Pay rate (Inc. casual loading)</Label>
                  <Input type="number" step="0.01" value={payRate} onChange={(e) => setPayRate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Pay rate (Exc. casual loading)</Label>
                  <Input type="number" step="0.01" value={payRateExclLoading} onChange={(e) => setPayRateExclLoading(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Charge rate (Exc. GST)</Label>
                  <Input type="number" step="0.01" value={chargeRate} onChange={(e) => setChargeRate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Factor rate</Label>
                  <Input type="number" step="0.001" value={factorRate} onChange={(e) => setFactorRate(e.target.value)} />
                </div>
                <AwardFields award={award} awardLevel={awardLevel} onAwardChange={setAward} onAwardLevelChange={setAwardLevel} />
                <div className="space-y-1.5">
                  <Label>Payment terms (days)</Label>
                  <Input type="number" value={paymentTermsDays} onChange={(e) => setPaymentTermsDays(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Position title</Label>
                  <Input value={positionTitle} onChange={(e) => setPositionTitle(e.target.value)} />
                </div>
              </div>
              <div className="flex items-center gap-4 mt-3">
                <label className="flex items-center gap-1.5 text-sm">
                  <Checkbox checked={overtimeApplicable} onCheckedChange={(c) => setOvertimeApplicable(!!c)} />Overtime applied
                </label>
                <label className="flex items-center gap-1.5 text-sm">
                  <Checkbox checked={poRequired} onCheckedChange={(c) => setPoRequired(!!c)} />PO required
                </label>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Working hours & schedule</h4>
              <WorkScheduleFields value={workingHours} onChange={setWorkingHours} />
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="space-y-1.5">
                  <Label>Lunch break (minutes)</Label>
                  <Input type="number" value={lunchBreak} onChange={(e) => setLunchBreak(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Start time on first day</Label>
                  <Input type="time" value={startTimeFirstDay} onChange={(e) => setStartTimeFirstDay(e.target.value)} />
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Additional contract details</h4>
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
              <div className="flex items-center gap-4 mt-3">
                <label className="flex items-center gap-1.5 text-sm">
                  <Checkbox checked={safetyCourseRequired} onCheckedChange={(c) => setSafetyCourseRequired(!!c)} />Safety course required
                </label>
                <label className="flex items-center gap-1.5 text-sm">
                  <Checkbox checked={viewToExtend} onCheckedChange={(c) => setViewToExtend(!!c)} />View to extend
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!startDate || saving}>{saving ? "Renewing…" : "Renew contract"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
