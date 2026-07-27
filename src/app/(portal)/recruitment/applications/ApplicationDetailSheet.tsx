"use client"

import { useEffect, useState, useCallback } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { ChevronUp, ChevronDown, Loader2 } from "lucide-react"
import { StagePipelineStrip } from "./[appId]/StagePipelineStrip"
import { CandidateSummaryCard, type CandidateSummary } from "./[appId]/CandidateSummaryCard"
import { ApplicationInfoCard, type ApplicationInfo } from "./[appId]/ApplicationInfoCard"
import { StageHistoryTimeline, type StageHistoryEntry } from "./[appId]/StageHistoryTimeline"
import { JobSummaryCard, type JobSummary } from "./[appId]/JobSummaryCard"
import { StageControl } from "./[appId]/StageControl"

interface ApplicationDetail extends ApplicationInfo {
  candidate: CandidateSummary | null
  job: JobSummary | null
  stage_history: StageHistoryEntry[]
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
  const [data, setData] = useState<ApplicationDetail | null>(null)
  const [loading, setLoading] = useState(false)

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
      load(applicationId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId, refreshToken])

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
    <Sheet open={!!applicationId} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl w-full overflow-y-auto">
        <SheetHeader className="flex-row items-center justify-between pr-10 border-b">
          <div className="min-w-0">
            <SheetTitle className="truncate">
              {data?.candidate ? `${data.candidate.first_name} ${data.candidate.last_name}` : "Application"}
            </SheetTitle>
            {positionLabel && <p className="text-xs text-muted-foreground">{positionLabel}</p>}
          </div>
          <div className="flex items-center gap-1 shrink-0">
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
                <ApplicationInfoCard app={data} />
                <div className="rounded-lg border bg-card p-4">
                  <h3 className="font-medium text-sm mb-3">Move stage</h3>
                  <StageControl appId={data.id} currentStage={data.stage} />
                </div>
                <JobSummaryCard job={data.job} />
                <StageHistoryTimeline history={data.stage_history} />
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
