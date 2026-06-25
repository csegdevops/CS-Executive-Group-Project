"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Pencil, Loader2 } from "lucide-react"
import { toast } from "sonner"

const FRAMEWORKS = ["aicis", "reach", "tsca"] as const
const FRAMEWORK_LABELS: Record<string, string> = { aicis: "AICIS", reach: "REACH", tsca: "TSCA" }

interface Initial {
  title: string
  description: string
  reference_number: string
  due_date: string
  frameworks: string[]
}

export function EditDetailsDialog({
  consultationId,
  initial,
}: {
  consultationId: string
  initial: Initial
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [title, setTitle]           = useState(initial.title)
  const [description, setDesc]      = useState(initial.description)
  const [refNum, setRefNum]         = useState(initial.reference_number)
  const [dueDate, setDueDate]       = useState(initial.due_date)
  const [frameworks, setFrameworks] = useState<string[]>(initial.frameworks)

  function toggleFramework(fw: string) {
    setFrameworks((prev) =>
      prev.includes(fw) ? prev.filter((f) => f !== fw) : [...prev, fw]
    )
  }

  async function handleSave() {
    if (!title.trim()) { toast.error("Title is required"); return }
    if (frameworks.length === 0) { toast.error("Select at least one framework"); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/consultations/${consultationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description || null,
          reference_number: refNum || null,
          due_date: dueDate || null,
          frameworks,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? "Save failed")
        return
      }
      toast.success("Details saved")
      setOpen(false)
      router.refresh()
    } catch {
      toast.error("Network error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-muted-foreground">
          <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Consultation Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Title *</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Consultation title" />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Reference Number</label>
            <Input value={refNum} onChange={(e) => setRefNum(e.target.value)} placeholder="e.g. CS-2026-001" />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Due Date</label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-2 block">Regulatory Frameworks *</label>
            <div className="flex gap-3">
              {FRAMEWORKS.map((fw) => (
                <label key={fw} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={frameworks.includes(fw)}
                    onChange={() => toggleFramework(fw)}
                    className="rounded"
                  />
                  {FRAMEWORK_LABELS[fw]}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Optional description"
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
