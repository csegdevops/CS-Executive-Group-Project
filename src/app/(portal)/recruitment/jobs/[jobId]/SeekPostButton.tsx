"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ExternalLink, Send, Loader2, X } from "lucide-react"
import { toast } from "sonner"

interface Props {
  jobId: string
  jobStatus: string
  seekAdId: string | null
  seekConfigured: boolean
}

export function SeekPostButton({ jobId, jobStatus, seekAdId, seekConfigured }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const isPosted = jobStatus === "posted" || !!seekAdId

  async function postToSeek() {
    setLoading(true)
    try {
      const res = await fetch(`/api/recruitment/jobs/${jobId}/seek-post`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "Failed to post to Seek")
        return
      }
      toast.success("Job posted to Seek")
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  async function withdrawFromSeek() {
    setLoading(true)
    try {
      const res = await fetch(`/api/recruitment/jobs/${jobId}/seek-post`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "Failed to withdraw")
        return
      }
      toast.success("Job withdrawn from Seek")
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm font-medium mb-3">Seek</p>

      {!seekConfigured ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Seek partner credentials not yet configured.
          </p>
          <a
            href="https://developer.seek.com.au"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline inline-flex items-center gap-1"
          >
            Apply for Seek Employer API access <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      ) : isPosted ? (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-green-600 font-medium">Live on Seek</p>
            {seekAdId && (
              <p className="text-xs text-muted-foreground font-mono mt-0.5">{seekAdId}</p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={withdrawFromSeek}
            disabled={loading}
            className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
            Withdraw
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Not posted to Seek.</p>
          <Button
            size="sm"
            onClick={postToSeek}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Post to Seek
          </Button>
        </div>
      )}
    </div>
  )
}
