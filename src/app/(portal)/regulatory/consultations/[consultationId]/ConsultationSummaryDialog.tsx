"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Sparkles, Loader2, RefreshCw } from "lucide-react"
import { toast } from "sonner"

export function ConsultationSummaryDialog({ consultationId }: { consultationId: string }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState<string | null>(null)

  async function generate() {
    setLoading(true)
    try {
      const res = await fetch(`/api/consultations/${consultationId}/summary`, { method: "POST" })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? "Failed to generate summary")
        return
      }
      const data = await res.json()
      setSummary(data.summary)
    } catch {
      toast.error("Network error")
    } finally {
      setLoading(false)
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next && summary === null && !loading) generate()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Sparkles className="h-4 w-4 mr-1.5" />
          Summarize
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Consultation Summary</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating summary…
          </div>
        ) : summary ? (
          <>
            <p className="text-sm whitespace-pre-wrap">{summary}</p>
            <div className="flex justify-end pt-2 border-t">
              <Button variant="ghost" size="sm" onClick={generate} disabled={loading}>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                Regenerate
              </Button>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground py-6 text-center">Failed to load summary.</p>
        )}
      </DialogContent>
    </Dialog>
  )
}
