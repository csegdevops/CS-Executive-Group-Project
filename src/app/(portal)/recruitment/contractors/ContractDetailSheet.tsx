"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ChevronUp, ChevronDown, Loader2, Maximize2, TriangleAlert } from "lucide-react"
import { getMissingContractFields } from "@/lib/recruitment/contract-completeness"
import { CandidateSummaryCard } from "../applications/[appId]/CandidateSummaryCard"
import { JobSummaryCard } from "../applications/[appId]/JobSummaryCard"
import { ExtendContractDialog } from "./[contractId]/ExtendContractDialog"
import { RenewContractDialog } from "./[contractId]/RenewContractDialog"
import { TerminateContractDialog } from "./[contractId]/TerminateContractDialog"
import { ContractDocumentUpload } from "./[contractId]/ContractDocumentUpload"
import { ContractTermsCard } from "./[contractId]/ContractTermsCard"
import { RateTermsCard } from "./[contractId]/RateTermsCard"
import { WorkingHoursCard } from "./[contractId]/WorkingHoursCard"
import { ClientContactsCard } from "./[contractId]/ClientContactsCard"
import { ContractHistoryCard } from "./[contractId]/ContractHistoryCard"
import { ContractTimeline } from "./[contractId]/ContractTimeline"

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-50 text-green-700",
  expired: "bg-gray-100 text-gray-500",
  terminated: "bg-red-50 text-red-600",
}

// Loose shape — mirrors whatever GET /api/recruitment/contracts/[contractId]
// returns; the card components below each pick the fields they need off it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ContractDetail = any

interface Props {
  contractId: string | null
  onOpenChange: (open: boolean) => void
  onNavigate: (direction: "prev" | "next") => void
  hasPrev: boolean
  hasNext: boolean
  /** Called when Renew succeeds, with the new contract's id — the caller
   * owns `contractId` (it drives prev/next through the underlying list), so
   * switching to the freshly-created contract happens up there. */
  onRenewed: (newContractId: string) => void
}

export function ContractDetailSheet({ contractId, onOpenChange, onNavigate, hasPrev, hasNext, onRenewed }: Props) {
  const [data, setData] = useState<ContractDetail | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (id: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/recruitment/contracts/${id}`)
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (contractId) {
      setData(null)
      load(contractId)
    }
  }, [contractId, load])

  useEffect(() => {
    if (!contractId) return
    function handleKey(e: KeyboardEvent) {
      const target = e.target
      if (target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return
      if (e.key === "ArrowUp" && hasPrev) { e.preventDefault(); onNavigate("prev") }
      if (e.key === "ArrowDown" && hasNext) { e.preventDefault(); onNavigate("next") }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [contractId, hasPrev, hasNext, onNavigate])

  const placement = data?.placement
  const candidate = placement?.candidate ?? null
  const job = placement?.job ?? null

  const today = new Date().toISOString().slice(0, 10)
  const isOnLeave = (data?.leave_periods ?? []).some(
    (l: { start_date: string; end_date: string | null }) => l.start_date <= today && (!l.end_date || l.end_date >= today)
  )
  const missingFields = data ? getMissingContractFields(data) : []

  function refresh() {
    if (contractId) load(contractId)
  }

  return (
    <Sheet open={!!contractId} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl w-full overflow-y-auto">
        <SheetHeader className="flex-row items-center justify-between pr-10 border-b">
          <div className="min-w-0 flex items-center gap-2">
            <SheetTitle className="truncate">
              {candidate ? `${candidate.first_name} ${candidate.last_name}` : "Contract"}
            </SheetTitle>
            {data && (
              <>
                {isOnLeave && <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700">On Leave</Badge>}
                {missingFields.length > 0 && (
                  <Badge variant="outline" className="text-xs bg-red-50 text-red-700 gap-1">
                    <TriangleAlert className="h-3 w-3" />Incomplete
                  </Badge>
                )}
                <Badge variant="outline" className={cn("text-xs", STATUS_COLORS[data.status] ?? "")}>
                  {data.status[0].toUpperCase() + data.status.slice(1)}
                </Badge>
              </>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {data && (
              <Button variant="outline" size="icon" className="h-7 w-7" asChild title="Open full page">
                <Link href={`/recruitment/contractors/${data.id}`}>
                  <Maximize2 className="h-3.5 w-3.5" />
                </Link>
              </Button>
            )}
            <Button variant="outline" size="icon" className="h-7 w-7" disabled={!hasPrev} onClick={() => onNavigate("prev")} title="Previous (↑)">
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-7 w-7" disabled={!hasNext} onClick={() => onNavigate("next")} title="Next (↓)">
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        <div className="px-4 pb-4">
          {loading || !data ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              <CandidateSummaryCard candidate={candidate} hideSkills />
              <ContractTermsCard contract={data} onSaved={refresh} />
              <RateTermsCard contract={data} lookups={data.lookups ?? []} onSaved={refresh} />
              <WorkingHoursCard contract={data} onSaved={refresh} />
              <ClientContactsCard
                contract={{ ...data, company_id: job?.company_id ?? null }}
                timesheetsSupervisor={data.timesheets_supervisor}
                timesheetsProvisioned={Boolean(placement?.id)}
                onSaved={refresh}
              />

              <JobSummaryCard job={job} />

              {data.status !== "terminated" && data.is_current && (
                <div className="rounded-lg border bg-card p-4 space-y-2">
                  <h3 className="font-medium text-sm mb-1">Actions</h3>
                  <ExtendContractDialog
                    contractId={data.id}
                    currentFinishDate={data.finish_date ?? placement?.finish_date ?? null}
                    onSaved={refresh}
                  />
                  <RenewContractDialog
                    onRenewed={onRenewed}
                    contract={{
                      id: data.id,
                      contract_number: data.contract_number,
                      notice_period: data.notice_period,
                      finish_date: data.finish_date ?? placement?.finish_date ?? null,
                      pay_rate: data.pay_rate,
                      charge_rate: data.charge_rate,
                      currency: data.currency,
                      factor_rate: data.factor_rate,
                      pay_rate_excl_casual_loading: data.pay_rate_excl_casual_loading,
                      award: data.award,
                      award_level: data.award_level,
                      payment_terms_days: data.payment_terms_days,
                      overtime_applicable: data.overtime_applicable,
                      po_required: data.po_required,
                      position_title: data.position_title,
                      safety_course_required: data.safety_course_required,
                      view_to_extend: data.view_to_extend,
                      permanent_conversion_status: data.permanent_conversion_status,
                      next_award_review_date: data.next_award_review_date,
                      reporting_contact_name: data.reporting_contact_name,
                      reporting_contact_email: data.reporting_contact_email,
                      work_attire_ppe: data.work_attire_ppe,
                      working_hours: data.working_hours,
                      lunch_break_minutes: data.lunch_break_minutes,
                      start_time_first_day: data.start_time_first_day,
                      job_reference_number: job?.reference_number ?? null,
                      job_title: job?.title ?? null,
                    }}
                  />
                  <TerminateContractDialog contractId={data.id} onSaved={refresh} />
                </div>
              )}

              <ContractHistoryCard contracts={data.siblings ?? []} currentId={data.id} />

              <ContractTimeline
                contractId={data.id}
                contractNumber={data.contract_number}
                createdAt={data.created_at}
                currentContractId={data.id}
                extensions={data.extensions ?? []}
                siblingRenewals={(data.siblings ?? []).filter((s: { id: string }) => s.id !== data.id)}
                leavePeriods={data.leave_periods ?? []}
                notes={data.notes ?? []}
                terminatedAt={data.terminated_at}
                terminationReason={data.termination_reason}
                onSaved={refresh}
              />

              <ContractDocumentUpload
                contractId={data.id}
                documentName={data.document_original_name}
                editable={data.status !== "terminated"}
                onSaved={refresh}
              />
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
