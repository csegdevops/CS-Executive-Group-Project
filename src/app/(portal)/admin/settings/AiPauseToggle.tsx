"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Sparkles } from "lucide-react"

export function AiPauseToggle({ initialPaused }: { initialPaused: boolean }) {
  const router = useRouter()
  const [paused, setPaused] = useState(initialPaused)
  const [pending, setPending] = useState(false)

  async function toggle() {
    const next = !paused
    setPending(true)
    try {
      const res = await fetch("/api/admin/system-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ai_paused: next }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(typeof body.error === "string" ? body.error : "Failed to update")
      }
      setPaused(next)
      toast.success(next ? "All AI features are now paused" : "AI features resumed")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className={cn(
      "border rounded-lg px-4 py-4 flex items-center justify-between gap-4",
      paused && "border-amber-300 bg-amber-50"
    )}>
      <div className="flex items-center gap-3 min-w-0">
        <Sparkles className={cn("h-5 w-5 shrink-0", paused ? "text-amber-600" : "text-muted-foreground")} />
        <div className="min-w-0">
          <p className="font-medium text-sm">Pause all AI features</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Stops CV parsing, formulation upload AI extraction, and consultation/company AI summaries from calling
            Gemini — requests fail with a clear &quot;paused&quot; message instead.
          </p>
        </div>
      </div>

      <button
        onClick={toggle}
        disabled={pending}
        aria-label={paused ? "Resume AI features" : "Pause all AI features"}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed",
          paused ? "bg-amber-500" : "bg-input"
        )}
      >
        <span
          className={cn(
            "pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform duration-200",
            paused ? "translate-x-5" : "translate-x-0"
          )}
        />
      </button>
    </div>
  )
}
