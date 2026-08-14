"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { ChevronUp, ChevronDown, Loader2, Maximize2 } from "lucide-react"
import { SplitSheetContent } from "@/components/recruitment/SplitSheetContent"
import type { DocumentPreviewTarget } from "@/components/recruitment/DocumentPreviewSheet"
import { StagePipelineStrip } from "./[appId]/StagePipelineStrip"
import { CandidateSummaryCard, type CandidateSummary } from "./[appId]/CandidateSummaryCard"
import { ApplicationInfoCard, type ApplicationInfo } from "./[appId]/ApplicationInfoCard"
import { StageHistoryTimeline, type StageHistoryEntry } from "./[appId]/StageHistoryTimeline"
import { ViewedBySection, type ViewerEntry } from "./[appId]/ViewedBySection"
import { JobSummaryCard, type JobSummary } from "./[appId]/JobSummaryCard"
import { StageControl } from "./[appId]/StageControl"
import { PlacementCard } from "./[appId]/PlacementCard"
import { DeleteApplicationButton } from "./DeleteApplicationButton"

interface Placement {
  id: string
  placement_type: "permanent" | "contract"
  start_date: string
  finish_date: string | null
  pay_rate: number | null
  charge_rate: number | null
  currency: string
}

interface ApplicationDetail extends ApplicationInfo {
  candidate_id: string
  job_id: string
  candidate: CandidateSummary | null
  job: (JobSummary & { company_id: string | null; employment_type: string | null }) | null
  stage_history: StageHistoryEntry[]
  viewers: ViewerEntry[]
  placement: Placement | null
  contractor_id: string | null
  remaining_vacancies: number
}

interface Props {
  applicationId: string | null
  onOpenChange: (open: boolean) => void
  onNavigate: (direction: "prev" | "next") => void
  hasPrev: boolean
  hasNext: boolean
  positionLabel?: string
  /** Bump this (e.g. `${stage}:${source_channel}` from the list row) to force a re-fetch after an edit made from inside the sheet refreshes the underlying list. */
  refreshToken?: string
}

export function ApplicationDetailSheet({
  applicationId,
  onOpenChange,
  onNavigate,
  hasPrev,
  hasNext,
  positionLabel,
  refreshToken,
}: Props) {
  const router = useRouter()
  const [data, setData] = useState<ApplicationDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [documentTarget, setDocumentTarget] = useState<DocumentPreviewTarget | null>(null)

  const load = useCallback(async (id: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/recruitment/applications/${id}`)
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (applicationId) {
      setData(null)
      setDocumentTarget(null)
      load(applicationId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId, refreshToken])

  // Mark-as-viewed fires once per sheet open (keyed only on applicationId,
  // not refreshToken, so internal refreshes from stage moves etc. don't
  // re-trigger it). Only bumps the underlying list when this genuinely was
  // the first view — reopening an already-viewed application is a no-op.
  useEffect(() => {
    if (!applicationId) return
    fetch(`/api/recruitment/applications/${applicationId}/view`, { method: "POST" })
      .then((res) => res.ok ? res.json() : null)
      .then((result) => { if (result?.created) router.refresh() })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId])

  useEffect(() => {
    if (!applicationId) return
    function handleKey(e: KeyboardEvent) {
      const target = e.target
      if (target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return
      if (e.key === "ArrowUp" && hasPrev) { e.preventDefault(); onNavigate("prev") }
      if (e.key === "ArrowDown" && hasNext) { e.preventDefault(); onNavigate("next") }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [applicationId, hasPrev, hasNext, onNavigate])

  return (
    <SplitSheetContent
      open={!!applicationId}
      onOpenChange={onOpenChange}
      documentTarget={documentTarget}
      onCloseDocument={() => setDocumentTarget(null)}
    >
      <SheetHeader className="flex-row items-center justify-between pr-10 border-b">
        <div className="min-w-0">
          <SheetTitle className="truncate">
            {data?.candidate ? `${data.candidate.first_name} ${data.candidate.last_name}` : "Application"}
          </SheetTitle>
          {positionLabel && <p className="text-xs text-muted-foreground">{positionLabel}</p>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {data && (
            <>
              <Button variant="outline" size="icon" className="h-7 w-7" asChild title="Open full page">
                <Link href={`/recruitment/applications/${data.id}`}>
                  <Maximize2 className="h-3.5 w-3.5" />
                </Link>
              </Button>
              <DeleteApplicationButton applicationId={data.id} onDeleted={() => onOpenChange(false)} />
            </>
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
          <>
            <StagePipelineStrip stage={data.stage} />
            <div className="space-y-4">
              <CandidateSummaryCard candidate={data.candidate} />
              <ApplicationInfoCard
                app={data}
                onPreview={(type, fileName) => setDocumentTarget({
                  inlineUrl: `/api/recruitment/applications/${data.id}/cv?type=${type}&disposition=inline`,
                  downloadUrl: `/api/recruitment/applications/${data.id}/cv?type=${type}`,
                  fileName,
                  title: type === "cl" ? "Cover letter" : "CV",
                })}
              />
              <ViewedBySection viewers={data.viewers} />
              {data.stage !== "placed" && (
                <div className="rounded-lg border bg-card p-4">
                  <h3 className="font-medium text-sm mb-3">Move stage</h3>
                  <StageControl appId={data.id} currentStage={data.stage} />
                </div>
              )}
              {(data.stage === "offer" || data.stage === "placed") && (
                <PlacementCard
                  applicationId={data.id}
                  jobId={data.job_id}
                  jobTitle={data.job?.title ?? null}
                  candidateId={data.candidate_id}
                  candidateName={data.candidate ? `${data.candidate.first_name} ${data.candidate.last_name}` : "Candidate"}
                  candidateEmail={data.candidate?.email ?? ""}
                  companyId={data.job?.company_id ?? null}
                  companyName={data.job?.company_name ?? null}
                  employmentType={data.job?.employment_type ?? null}
                  placement={data.placement}
                  contractorId={data.contractor_id}
                  remainingVacancies={data.remaining_vacancies}
                />
              )}
              <JobSummaryCard job={data.job} />
              <StageHistoryTimeline history={data.stage_history} />
            </div>
          </>
        )}
      </div>
    </SplitSheetContent>
  )
}
