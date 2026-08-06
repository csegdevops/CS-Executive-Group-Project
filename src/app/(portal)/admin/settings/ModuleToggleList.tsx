"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { FlaskConical, Users, Clock } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { ModuleConfig, Module } from "@/types/database"

const MODULE_META: Record<Module, { label: string; description: string; icon: React.ElementType }> = {
  regulatory: {
    label: "Regulatory Database",
    description: "AICIS, REACH, TSCA compliance and chemical assessments.",
    icon: FlaskConical,
  },
  recruitment: {
    label: "Recruitment",
    description: "Job postings, candidates, applications, and client/BD relationships.",
    icon: Users,
  },
  timesheets: {
    label: "Timesheets",
    description: "Contractor timesheets, approvals, and contracts.",
    icon: Clock,
  },
}

export function ModuleToggleList({ configs }: { configs: ModuleConfig[] }) {
  const router = useRouter()
  const [pending, setPending] = useState<Module | null>(null)
  // Only initialise from DB rows — don't default unknown modules to true
  const [states, setStates] = useState<Record<string, boolean>>(
    Object.fromEntries(configs.map((c) => [c.module, c.is_enabled]))
  )
  const ready = configs.length > 0

  async function toggle(module: Module) {
    const current = states[module]
    const next = !current
    setPending(module)
    try {
      const res = await fetch("/api/admin/modules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module, is_enabled: next }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Server error ${res.status}`)
      }
      setStates((prev) => ({ ...prev, [module]: next }))
      toast.success(`${MODULE_META[module].label} ${next ? "enabled" : "disabled"}`)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update module")
    } finally {
      setPending(null)
    }
  }

  if (!ready) {
    return (
      <p className="text-sm text-muted-foreground border rounded-lg px-4 py-6 text-center">
        Module configuration not found. Run the pending database migration and reload.
      </p>
    )
  }

  return (
    <div className="border rounded-lg divide-y text-sm">
      {(["regulatory", "recruitment", "timesheets"] as Module[]).map((mod) => {
        const meta   = MODULE_META[mod]
        const Icon   = meta.icon
        const on     = states[mod] ?? true
        const busy   = pending === mod

        return (
          <div key={mod} className="flex items-center justify-between gap-4 px-4 py-4">
            <div className="flex items-center gap-3 min-w-0">
              <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="font-medium">{meta.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{meta.description}</p>
              </div>
            </div>

            <button
              onClick={() => toggle(mod)}
              disabled={busy}
              aria-label={on ? `Disable ${meta.label}` : `Enable ${meta.label}`}
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed",
                on ? "bg-primary" : "bg-input"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform duration-200",
                  on ? "translate-x-5" : "translate-x-0"
                )}
              />
            </button>
          </div>
        )
      })}
    </div>
  )
}
