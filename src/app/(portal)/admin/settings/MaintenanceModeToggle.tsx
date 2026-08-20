"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { ShieldAlert } from "lucide-react"

export function MaintenanceModeToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const router = useRouter()
  const [enabled, setEnabled] = useState(initialEnabled)
  const [pending, setPending] = useState(false)

  async function toggle() {
    const next = !enabled
    setPending(true)
    try {
      const res = await fetch("/api/admin/system-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maintenance_mode: next }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(typeof body.error === "string" ? body.error : "Failed to update")
      }
      setEnabled(next)
      toast.success(next ? "Maintenance mode is on — only super admins can use the portal" : "Maintenance mode is off")
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
      enabled && "border-red-300 bg-red-50"
    )}>
      <div className="flex items-center gap-3 min-w-0">
        <ShieldAlert className={cn("h-5 w-5 shrink-0", enabled ? "text-red-600" : "text-muted-foreground")} />
        <div className="min-w-0">
          <p className="font-medium text-sm">Maintenance mode</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Locks the entire portal — internal staff and timesheets contractors/supervisors alike — to a maintenance
            page. Only super admins can still sign in and use the portal while this is on.
          </p>
        </div>
      </div>

      <button
        onClick={toggle}
        disabled={pending}
        aria-label={enabled ? "Turn off maintenance mode" : "Turn on maintenance mode"}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed",
          enabled ? "bg-red-600" : "bg-input"
        )}
      >
        <span
          className={cn(
            "pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform duration-200",
            enabled ? "translate-x-5" : "translate-x-0"
          )}
        />
      </button>
    </div>
  )
}
