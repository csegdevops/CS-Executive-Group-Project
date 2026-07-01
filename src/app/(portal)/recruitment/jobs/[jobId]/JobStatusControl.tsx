"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import type { JobStatus } from "@/types/database"

const STATUSES: JobStatus[] = ["opened", "posted", "active", "paused", "filled", "closed"]
const STATUS_LABELS: Record<JobStatus, string> = {
  opened: "Opened",
  posted: "Posted",
  active: "Active",
  paused: "Paused",
  filled: "Filled",
  closed: "Closed",
}

export function JobStatusControl({ jobId, currentStatus }: { jobId: string; currentStatus: string }) {
  const router = useRouter()
  const [status, setStatus] = useState(currentStatus)
  const [saving, setSaving] = useState(false)

  async function handleChange(newStatus: string) {
    if (newStatus === status) return
    setSaving(true)
    try {
      const res = await fetch(`/api/recruitment/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) { toast.error("Failed to update status"); return }
      setStatus(newStatus)
      toast.success(`Job marked as ${newStatus}`)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Select value={status} onValueChange={handleChange} disabled={saving}>
      <SelectTrigger className="h-8 text-xs w-32">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUSES.map(s => (
          <SelectItem key={s} value={s} className="text-xs capitalize">
            {STATUS_LABELS[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
