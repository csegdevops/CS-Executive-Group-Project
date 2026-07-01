"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"

const STAGE_OPTIONS = [
  { value: "applied",         label: "Applied" },
  { value: "screening",       label: "Screening" },
  { value: "shortlisted",     label: "Shortlisted" },
  { value: "interview_1",     label: "Interview 1" },
  { value: "interview_2",     label: "Interview 2" },
  { value: "reference_check", label: "Reference Check" },
  { value: "offer",           label: "Offer" },
  { value: "placed",          label: "Placed" },
  { value: "withdrawn",       label: "Withdrawn" },
  { value: "rejected",        label: "Rejected" },
]

export function StageControl({ appId, currentStage }: { appId: string; currentStage: string }) {
  const router = useRouter()
  const [stage, setStage]   = useState(currentStage)
  const [notes, setNotes]   = useState("")
  const [saving, setSaving] = useState(false)

  async function handleMove() {
    if (stage === currentStage) return
    setSaving(true)
    try {
      const res = await fetch(`/api/recruitment/applications/${appId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage, stage_notes: notes || undefined }),
      })
      if (!res.ok) { toast.error("Failed to update stage"); return }
      toast.success(`Moved to ${stage.replace(/_/g, " ")}`)
      setNotes("")
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-2">
      <Select value={stage} onValueChange={setStage}>
        <SelectTrigger className="text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STAGE_OPTIONS.map(s => (
            <SelectItem key={s.value} value={s.value} className="text-sm">{s.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <textarea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="Optional note…"
        rows={2}
        className="w-full text-xs rounded-md border border-border bg-background px-2.5 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
      />
      <Button
        size="sm"
        className="w-full"
        onClick={handleMove}
        disabled={stage === currentStage || saving}
      >
        {saving ? "Saving…" : "Move"}
      </Button>
    </div>
  )
}
