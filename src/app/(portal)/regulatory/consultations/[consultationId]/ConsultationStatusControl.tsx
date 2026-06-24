"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

const STATUS_OPTIONS = [
  { value: "draft",        label: "Draft" },
  { value: "in_progress",  label: "In Progress" },
  { value: "under_review", label: "Under Review" },
  { value: "completed",    label: "Completed" },
  { value: "archived",     label: "Archived" },
] as const

const STATUS_STYLES: Record<string, string> = {
  draft:        "bg-gray-100 text-gray-700 border-gray-300",
  in_progress:  "bg-blue-100 text-blue-700 border-blue-300",
  under_review: "bg-amber-100 text-amber-700 border-amber-300",
  completed:    "bg-green-100 text-green-700 border-green-300",
  archived:     "bg-gray-100 text-gray-500 border-gray-300",
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
      <select
        value={status}
        onChange={(e) => handleChange(e.target.value)}
        disabled={saving}
        className={`text-xs font-medium rounded-full border px-3 py-1 appearance-none cursor-pointer transition-colors disabled:opacity-60 ${STATUS_STYLES[status] ?? STATUS_STYLES.draft}`}
      >
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  )
}
