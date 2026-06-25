"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Loader2, ClipboardList, Building2, CheckCircle2, Circle } from "lucide-react"
import { toast } from "sonner"

interface Consultation {
  id: string
  title: string
  status: string
  reference_number: string | null
  company_id: string
  companies: { id: string; name: string } | null
  consultant_ids: string[]
}

const STATUS_COLORS: Record<string, string> = {
  draft:        "bg-gray-100 text-gray-600",
  in_progress:  "bg-blue-100 text-blue-700",
  under_review: "bg-yellow-100 text-yellow-700",
  completed:    "bg-green-100 text-green-700",
  archived:     "bg-gray-100 text-gray-400",
}

export function AssignConsultationsDialog({
  userId,
  userName,
}: {
  userId: string
  userName: string | null
}) {
  const [open, setOpen]                     = useState(false)
  const [consultations, setConsultations]   = useState<Consultation[]>([])
  const [loading, setLoading]               = useState(false)
  const [toggling, setToggling]             = useState<string | null>(null)

  const fetchConsultations = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/consultations")
      if (!res.ok) { toast.error("Failed to load consultations"); return }
      setConsultations(await res.json())
    } catch {
      toast.error("Network error")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) fetchConsultations()
  }, [open, fetchConsultations])

  async function toggle(consultationId: string, currently: boolean) {
    setToggling(consultationId)
    try {
      if (currently) {
        const res = await fetch(
          `/api/users/${userId}/consultations?consultation_id=${consultationId}`,
          { method: "DELETE" }
        )
        if (!res.ok) { toast.error("Failed to unassign"); return }
        setConsultations((prev) =>
          prev.map((c) =>
            c.id === consultationId
              ? { ...c, consultant_ids: c.consultant_ids.filter((id) => id !== userId) }
              : c
          )
        )
        toast.success("Unassigned")
      } else {
        const res = await fetch(`/api/users/${userId}/consultations`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ consultation_id: consultationId }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          toast.error(err.error ?? "Failed to assign")
          return
        }
        setConsultations((prev) =>
          prev.map((c) =>
            c.id === consultationId
              ? { ...c, consultant_ids: [...c.consultant_ids, userId] }
              : c
          )
        )
        toast.success("Assigned")
      }
    } catch {
      toast.error("Network error")
    } finally {
      setToggling(null)
    }
  }

  const assigned   = consultations.filter((c) => c.consultant_ids.includes(userId))
  const unassigned = consultations.filter(
    (c) => !c.consultant_ids.includes(userId) && !["completed", "archived"].includes(c.status)
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <ClipboardList className="h-3 w-3" />
          Consultations
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Consultations — {userName ?? "User"}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : consultations.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No consultations exist yet.
          </p>
        ) : (
          <div className="flex-1 overflow-y-auto -mx-6 px-6 space-y-1">
            {[
              { label: "Assigned", items: assigned,   checked: true  },
              { label: "Available", items: unassigned, checked: false },
            ].map(({ label, items, checked }) =>
              items.length > 0 ? (
                <div key={label} className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-3 pb-1">
                    {label} ({items.length})
                  </p>
                  {items.map((c) => {
                    const isToggling = toggling === c.id
                    return (
                      <button
                        key={c.id}
                        disabled={isToggling}
                        onClick={() => toggle(c.id, checked)}
                        className="w-full flex items-start gap-3 px-3 py-2.5 rounded-md text-left transition-colors hover:bg-muted/60 disabled:opacity-60"
                      >
                        <span className="mt-0.5 shrink-0 text-muted-foreground">
                          {isToggling ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : checked ? (
                            <CheckCircle2 className="h-4 w-4 text-primary" />
                          ) : (
                            <Circle className="h-4 w-4" />
                          )}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-medium truncate">{c.title}</span>
                          <span className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                            <Building2 className="h-3 w-3 shrink-0" />
                            {c.companies?.name ?? "—"}
                            {c.reference_number && (
                              <span className="text-muted-foreground/60">· {c.reference_number}</span>
                            )}
                          </span>
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-xs shrink-0 capitalize ${STATUS_COLORS[c.status] ?? ""}`}
                        >
                          {c.status.replace("_", " ")}
                        </Badge>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {c.consultant_ids.length} consultant{c.consultant_ids.length !== 1 ? "s" : ""}
                        </span>
                      </button>
                    )
                  })}
                </div>
              ) : null
            )}
          </div>
        )}

        <div className="pt-3 border-t flex justify-between items-center text-xs text-muted-foreground">
          <span>{assigned.length} assigned</span>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
