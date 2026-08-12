"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ExternalLink, Send, Loader2, X } from "lucide-react"
import { toast } from "sonner"

interface Props {
  jobId: string
  wpPostId: string | null
  wpPermalink: string | null
  wordpressConfigured: boolean
}

export function WordPressPostButton({ jobId, wpPostId, wpPermalink, wordpressConfigured }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const isPosted = !!wpPostId

  async function postToWordPress() {
    setLoading(true)
    try {
      const res = await fetch(`/api/recruitment/jobs/${jobId}/wordpress-post`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "Failed to post to WordPress")
        return
      }
      toast.success(isPosted ? "WordPress post updated" : "Job posted to WordPress")
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  async function withdrawFromWordPress() {
    setLoading(true)
    try {
      const res = await fetch(`/api/recruitment/jobs/${jobId}/wordpress-post`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "Failed to withdraw")
        return
      }
      toast.success("Job withdrawn from WordPress")
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm font-medium mb-3">WordPress</p>

      {!wordpressConfigured ? (
        <p className="text-xs text-muted-foreground">
          WordPress credentials not yet configured. Set WORDPRESS_URL, WORDPRESS_API_USER, and WORDPRESS_APP_PASSWORD to enable.
        </p>
      ) : isPosted ? (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-green-600 font-medium">Live on WordPress</p>
            {wpPermalink && (
              <a
                href={wpPermalink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-0.5"
              >
                View post <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={postToWordPress} disabled={loading}>
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Update
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={withdrawFromWordPress}
              disabled={loading}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
              Withdraw
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Not posted to WordPress.</p>
          <Button size="sm" onClick={postToWordPress} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Post to WordPress
          </Button>
        </div>
      )}
    </div>
  )
}
