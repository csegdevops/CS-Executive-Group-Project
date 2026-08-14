"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, Plus, Check } from "lucide-react"
import { toast } from "sonner"
import type { MatchingCandidate } from "@/lib/recruitment/find-matching-candidates"
import { CandidateDetailSheet } from "../../candidates/CandidateDetailSheet"

interface Props {
  jobId: string
  matches: MatchingCandidate[]
  hasRequirements: boolean
}

export function JobMatchesTab({ jobId, matches, hasRequirements }: Props) {
  const router = useRouter()
  const [addingId, setAddingId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  function handleRowOpen(e: React.MouseEvent, id: string) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
    e.preventDefault()
    setSelectedId(id)
  }

  async function handleAdd(candidateId: string) {
    setAddingId(candidateId)
    try {
      const res = await fetch("/api/recruitment/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidate_id: candidateId, job_id: jobId, source_channel: "database_internal" }),
      })
      const result = await res.json()
      if (!res.ok) { toast.error(result.error ?? "Failed to add"); return }
      if (result.status === "duplicate_skipped") toast.info("This candidate already has an application for this job")
      else toast.success("Added to job — stage: Applied")
      router.refresh()
    } finally {
      setAddingId(null)
    }
  }

  if (!hasRequirements) {
    return (
      <div className="text-center py-16 text-sm text-muted-foreground border rounded-lg max-w-md mx-auto">
        No required skills or education background set for this job yet. Add some via the Edit button, and matching candidates from the talent pool will show up here automatically.
      </div>
    )
  }

  if (matches.length === 0) {
    return (
      <div className="text-center py-16 text-sm text-muted-foreground border rounded-lg">
        No candidates in the talent pool currently match this job&apos;s required skills or education background.
      </div>
    )
  }

  const selectedIndex = selectedId ? matches.findIndex(m => m.id === selectedId) : -1

  return (
    <>
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Candidate</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Matched</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs hidden sm:table-cell">Match</th>
              <th className="w-28" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {matches.map((m) => (
              <tr key={m.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3">
                  <Link href={`/recruitment/candidates/${m.id}`} className="font-medium hover:underline" onClick={(e) => handleRowOpen(e, m.id)}>
                    {m.first_name} {m.last_name}
                  </Link>
                  {m.current_title && <p className="text-xs text-muted-foreground">{m.current_title}</p>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1 max-w-sm">
                    {m.matched_skills.map((t) => (
                      <Badge key={t} variant="secondary" className="text-xs">{t.replace(/_/g, " ")}</Badge>
                    ))}
                    {m.matched_education_tags.map((t) => (
                      <Badge key={t} variant="outline" className="text-xs">{t.replace(/_/g, " ")}</Badge>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 hidden sm:table-cell text-sm text-muted-foreground">{m.match_pct}%</td>
                <td className="px-2 py-3 text-right">
                  {m.already_applied ? (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Check className="h-3.5 w-3.5" />Applied
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      disabled={addingId === m.id}
                      onClick={() => handleAdd(m.id)}
                    >
                      {addingId === m.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                      Add
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CandidateDetailSheet
        candidateId={selectedId}
        onOpenChange={(open) => { if (!open) setSelectedId(null) }}
        onNavigate={(direction) => {
          if (selectedIndex < 0) return
          const nextIndex = direction === "prev" ? selectedIndex - 1 : selectedIndex + 1
          if (nextIndex >= 0 && nextIndex < matches.length) setSelectedId(matches[nextIndex].id)
        }}
        hasPrev={selectedIndex > 0}
        hasNext={selectedIndex >= 0 && selectedIndex < matches.length - 1}
        positionLabel={selectedIndex >= 0 ? `${selectedIndex + 1} of ${matches.length}` : undefined}
      />
    </>
  )
}
