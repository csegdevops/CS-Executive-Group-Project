"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { ChevronUp, ChevronDown, Loader2, Maximize2 } from "lucide-react"
import { SplitSheetContent } from "@/components/recruitment/SplitSheetContent"
import type { DocumentPreviewTarget } from "@/components/recruitment/DocumentPreviewSheet"
import { CandidateSummaryCard, type CandidateSummary } from "../applications/[appId]/CandidateSummaryCard"
import { CandidateDocumentsSection, type DocumentEntry } from "./[candidateId]/CandidateDocumentsSection"

const STAGE_LABELS: Record<string, string> = {
  applied: "Applied", screening: "Screening", shortlisted: "Shortlisted",
  interview_1: "Interview 1", interview_2: "Interview 2",
  reference_check: "Ref Check", offer: "Offer", placed: "Placed",
  withdrawn: "Withdrawn", rejected: "Rejected",
}

const SOURCE_LABELS: Record<string, string> = {
  seek_inbound: "Seek [S]", company_website: "Website [CSEG]",
  database_internal: "Internal [DB]", seek_talent: "Seek Talent [ST]", linkedin: "LinkedIn [LI]",
}

interface ApplicationEntry {
  id: string
  job_id: string
  stage: string
  source_channel: string
  created_at: string
  job_title: string | null
  company_name: string | null
}

interface CandidateDetail extends CandidateSummary {
  source_channel: string | null
  cv_parse_status: string
  created_at: string
  applications: ApplicationEntry[]
  documents: DocumentEntry[]
}

interface Props {
  candidateId: string | null
  onOpenChange: (open: boolean) => void
  onNavigate: (direction: "prev" | "next") => void
  hasPrev: boolean
  hasNext: boolean
  positionLabel?: string
}

export function CandidateDetailSheet({ candidateId, onOpenChange, onNavigate, hasPrev, hasNext, positionLabel }: Props) {
  const [data, setData] = useState<CandidateDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [documentTarget, setDocumentTarget] = useState<DocumentPreviewTarget | null>(null)

  const load = useCallback(async (id: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/recruitment/candidates/${id}`)
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (candidateId) {
      setData(null)
      setDocumentTarget(null)
      load(candidateId)
    }
  }, [candidateId, load])

  useEffect(() => {
    if (!candidateId) return
    function handleKey(e: KeyboardEvent) {
      const target = e.target
      if (target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return
      if (e.key === "ArrowUp" && hasPrev) { e.preventDefault(); onNavigate("prev") }
      if (e.key === "ArrowDown" && hasNext) { e.preventDefault(); onNavigate("next") }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [candidateId, hasPrev, hasNext, onNavigate])

  function handlePreview(doc: DocumentEntry) {
    if (!data) return
    setDocumentTarget({
      inlineUrl: `/api/recruitment/candidates/${data.id}/documents/${doc.id}?disposition=inline`,
      downloadUrl: `/api/recruitment/candidates/${data.id}/documents/${doc.id}`,
      fileName: doc.original_name,
      title: doc.doc_type === "cl" ? "Cover letter" : "CV",
    })
  }

  return (
    <SplitSheetContent
      open={!!candidateId}
      onOpenChange={onOpenChange}
      documentTarget={documentTarget}
      onCloseDocument={() => setDocumentTarget(null)}
    >
      <SheetHeader className="flex-row items-center justify-between pr-10 border-b">
        <div className="min-w-0">
          <SheetTitle className="truncate">
            {data ? `${data.first_name} ${data.last_name}` : "Candidate"}
          </SheetTitle>
          {positionLabel && <p className="text-xs text-muted-foreground">{positionLabel}</p>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {data && (
            <Button variant="outline" size="icon" className="h-7 w-7" asChild title="Open full profile">
              <Link href={`/recruitment/candidates/${data.id}`}>
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
          <div className="space-y-4 pt-4">
            <CandidateSummaryCard candidate={data} />

            <div className="rounded-lg border bg-card p-4 space-y-2 text-sm">
              <h3 className="font-medium text-sm mb-1">Details</h3>
              <div>
                <p className="text-xs text-muted-foreground">Source</p>
                <p>{data.source_channel ? (SOURCE_LABELS[data.source_channel] ?? data.source_channel) : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">CV status</p>
                <p className="capitalize">{data.cv_parse_status ?? "unparsed"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Added</p>
                <p>{new Date(data.created_at).toLocaleDateString("en-AU")}</p>
              </div>
            </div>

            <CandidateDocumentsSection
              candidateId={data.id}
              documents={data.documents}
              cvParseStatus={data.cv_parse_status ?? "unparsed"}
              onPreview={handlePreview}
            />

            <div className="rounded-lg border bg-card p-4">
              <h3 className="font-medium text-sm mb-3">Applications ({data.applications.length})</h3>
              {data.applications.length === 0 ? (
                <p className="text-sm text-muted-foreground">No applications yet.</p>
              ) : (
                <div className="space-y-2">
                  {data.applications.map((a) => (
                    <Link
                      key={a.id}
                      href={`/recruitment/applications/${a.id}`}
                      className="block rounded-md border p-2.5 hover:bg-muted/30 transition-colors"
                    >
                      <p className="text-sm font-medium">{a.job_title ?? "Unknown"}</p>
                      {a.company_name && <p className="text-xs text-muted-foreground">{a.company_name}</p>}
                      <p className="text-xs text-muted-foreground capitalize mt-0.5">
                        {STAGE_LABELS[a.stage] ?? a.stage}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </SplitSheetContent>
  )
}
