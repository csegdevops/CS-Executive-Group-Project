"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const STATUS_OPTIONS = [
  { value: "draft",        label: "Draft" },
  { value: "in_progress",  label: "In Progress" },
  { value: "under_review", label: "Under Review" },
  { value: "completed",    label: "Completed" },
  { value: "archived",     label: "Archived" },
] as const

const STATUS_STYLES: Record<string, string> = {
  draft:        "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200",
  in_progress:  "bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-200",
  under_review: "bg-amber-100 text-amber-700 border-amber-300 hover:bg-amber-200",
  completed:    "bg-green-100 text-green-700 border-green-300 hover:bg-green-200",
  archived:     "bg-gray-100 text-gray-500 border-gray-300 hover:bg-gray-200",
}

export function ConsultationStatusControl({
  consultationId,
  initialStatus,
}: {
  consultationId: string
  initialStatus: string
}) {
  const router = useRouter()
  const [status, setStatus] = useState(initialStatus)
  const [saving, setSaving] = useState(false)

  async function handleChange(newStatus: string) {
    if (newStatus === status) return
    setSaving(true)
    try {
      const res = await fetch(`/api/consultations/${consultationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? "Failed to update status")
        return
      }
      setStatus(newStatus)
      router.refresh()
      toast.success("Status updated")
    } catch {
      toast.error("Network error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      <Select value={status} onValueChange={handleChange} disabled={saving}>
        <SelectTrigger
          size="sm"
          className={`rounded-full text-xs font-medium w-auto shadow-none ${STATUS_STYLES[status] ?? STATUS_STYLES.draft}`}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          {STATUS_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
