"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { CheckCircle2, Circle, Loader2, ChevronRight } from "lucide-react"
import { toast } from "sonner"
import type { DuplicateCluster, CandidateDuplicateSummary } from "@/lib/recruitment/find-duplicate-clusters"

const SIGNAL_LABELS: Record<string, string> = {
  email: "Email",
  phone: "Phone",
  linkedin: "LinkedIn",
}

function CandidateLine({ c }: { c: CandidateDuplicateSummary }) {
  return (
    <div className="min-w-0">
      <Link href={`/recruitment/candidates/${c.id}`} target="_blank" className="font-medium text-sm hover:underline">
        {c.first_name} {c.last_name}
      </Link>
      <p className="text-xs text-muted-foreground truncate">{c.email}</p>
      <p className="text-xs text-muted-foreground">
        {[c.phone, c.linkedin_url && "LinkedIn on file"].filter(Boolean).join(" · ") || "—"}
        {" · "}{c.profile_completeness_pct}% complete
      </p>
    </div>
  )
}

function ClusterCard({ cluster, onMerged }: { cluster: DuplicateCluster; onMerged: (clusterId: string) => void }) {
  const [primaryId, setPrimaryId] = useState(cluster.suggested_primary_id)
  const [confirming, setConfirming] = useState(false)
  const [merging, setMerging] = useState(false)

  const primary = cluster.candidates.find((c) => c.id === primaryId)!
  const others = cluster.candidates.filter((c) => c.id !== primaryId)

  async function handleMerge() {
    setMerging(true)
    let successCount = 0
    for (const dup of others) {
      try {
        const res = await fetch("/api/recruitment/candidates/merge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ primary_id: primaryId, duplicate_id: dup.id }),
        })
        if (res.ok) {
          successCount++
        } else {
          const err = await res.json()
          toast.error(`Could not merge ${dup.first_name} ${dup.last_name}: ${err.error ?? "unknown error"}`)
        }
      } catch {
        toast.error(`Network error merging ${dup.first_name} ${dup.last_name}`)
      }
    }
    setMerging(false)
    setConfirming(false)
    if (successCount > 0) {
      toast.success(`Merged ${successCount} profile${successCount !== 1 ? "s" : ""} into ${primary.first_name} ${primary.last_name}`)
    }
    if (successCount === others.length) {
      onMerged(cluster.cluster_id)
    }
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-1.5 mb-3">
        {cluster.matched_signals.map((s) => (
          <Badge key={s} variant="outline" className="text-xs">{SIGNAL_LABELS[s] ?? s} match</Badge>
        ))}
      </div>

      <div className="space-y-2">
        {cluster.candidates.map((c) => {
          const isPrimary = c.id === primaryId
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setPrimaryId(c.id)}
              className={`w-full flex items-center gap-3 rounded-md border p-3 text-left transition-colors ${
                isPrimary ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30"
              }`}
            >
              {isPrimary
                ? <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                : <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />}
              <CandidateLine c={c} />
              {isPrimary && <Badge className="ml-auto shrink-0 text-xs">Keep as primary</Badge>}
            </button>
          )
        })}
      </div>

      <div className="flex justify-end mt-3">
        <Button size="sm" onClick={() => setConfirming(true)}>
          Merge into {primary.first_name}
          <ChevronRight className="h-3.5 w-3.5 ml-1" />
        </Button>
      </div>

      <Dialog open={confirming} onOpenChange={(open) => !merging && setConfirming(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm merge</DialogTitle>
          </DialogHeader>
          <div className="text-sm space-y-2 text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">{others.map((o) => `${o.first_name} ${o.last_name}`).join(", ")}</span>{" "}
              will be merged into <span className="font-medium text-foreground">{primary.first_name} {primary.last_name}</span>.
            </p>
            <ul className="list-disc pl-4 space-y-1">
              <li>Their applications, placements, tasks and notes move to {primary.first_name}.</li>
              <li>If they applied to the same job as {primary.first_name}, the duplicate application is discarded.</li>
              <li>Any profile detail {primary.first_name} is missing gets filled in from the merged record.</li>
              <li>The merged-away profile{others.length !== 1 ? "s are" : " is"} permanently deleted. This cannot be undone.</li>
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)} disabled={merging}>Cancel</Button>
            <Button onClick={handleMerge} disabled={merging}>
              {merging && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Confirm merge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function DuplicatesClient({ clusters }: { clusters: DuplicateCluster[] }) {
  const [remaining, setRemaining] = useState(clusters)

  function handleMerged(clusterId: string) {
    setRemaining((prev) => prev.filter((c) => c.cluster_id !== clusterId))
  }

  if (remaining.length === 0) {
    return (
      <div className="text-center py-16 text-sm text-muted-foreground border rounded-lg">
        No possible duplicates found.
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-2xl">
      {remaining.map((cluster) => (
        <ClusterCard key={cluster.cluster_id} cluster={cluster} onMerged={handleMerged} />
      ))}
    </div>
  )
}
