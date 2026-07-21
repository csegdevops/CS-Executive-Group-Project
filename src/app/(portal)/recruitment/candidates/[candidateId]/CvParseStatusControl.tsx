"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, Loader2 } from "lucide-react"
import { toast } from "sonner"

const POLL_INTERVAL_MS = 3000
// A single parse attempt is bounded at ~45s (see gemini.ts's httpOptions
// timeout, retries disabled) — 16 polls comfortably covers that worst case.
const MAX_POLLS = 16

interface Props {
  candidateId: string
  status: string
}

export function CvParseStatusControl({ candidateId, status }: Props) {
  const router = useRouter()
  const [triggering, setTriggering] = useState(false)
  const [stalled, setStalled] = useState(false)
  const pollCount = useRef(0)

  // While parsing is in flight, poll for the status to change by refreshing
  // server data — router.refresh() re-renders this component with the
  // latest cv_parse_status once the background parse (via after()) finishes.
  useEffect(() => {
    if (status !== "pending") { pollCount.current = 0; setStalled(false); return }
    if (pollCount.current >= MAX_POLLS) { setStalled(true); return }

    const timer = setTimeout(() => {
      pollCount.current += 1
      router.refresh()
    }, POLL_INTERVAL_MS)
    return () => clearTimeout(timer)
  }, [status, router])

  async function handleParse() {
    setTriggering(true)
    try {
      const res = await fetch(`/api/recruitment/candidates/${candidateId}/parse-cv`, { method: "POST" })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error ?? "Could not start parsing")
        return
      }
      pollCount.current = 0
      setStalled(false)
      toast.success("Parsing started")
      router.refresh()
    } catch {
      toast.error("Network error")
    } finally {
      setTriggering(false)
    }
  }

  if (status === "pending" && stalled) {
    return (
      <div className="flex items-center gap-1.5">
        <Badge variant="outline" className="text-xs text-muted-foreground">Still processing — check back shortly</Badge>
        <Button size="sm" variant="ghost" className="h-6 px-2 gap-1 text-xs" onClick={() => router.refresh()}>
          <RefreshCw className="h-3 w-3" />Check now
        </Button>
      </div>
    )
  }

  if (status === "pending") {
    return (
      <Badge variant="outline" className="text-xs gap-1">
        <Loader2 className="h-3 w-3 animate-spin" />Parsing…
      </Badge>
    )
  }

  if (status === "parsed") {
    return (
      <div className="flex items-center gap-1.5">
        <Badge variant="outline" className="text-xs text-green-700 border-green-200">Parsed</Badge>
        <Button size="sm" variant="ghost" className="h-6 px-2 gap-1 text-xs" onClick={handleParse} disabled={triggering}>
          <RefreshCw className="h-3 w-3" />Re-parse
        </Button>
      </div>
    )
  }

  if (status === "failed") {
    return (
      <div className="flex items-center gap-1.5">
        <Badge variant="outline" className="text-xs text-destructive border-destructive/30">Parse failed</Badge>
        <Button size="sm" variant="ghost" className="h-6 px-2 gap-1 text-xs" onClick={handleParse} disabled={triggering}>
          <RefreshCw className="h-3 w-3" />Retry
        </Button>
      </div>
    )
  }

  return (
    <Button size="sm" variant="ghost" className="h-6 px-2 gap-1 text-xs" onClick={handleParse} disabled={triggering}>
      {triggering ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
      Parse CV
    </Button>
  )
}
