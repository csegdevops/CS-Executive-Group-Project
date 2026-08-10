"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Pencil, Loader2 } from "lucide-react"
import { toast } from "sonner"

const SOURCE_OPTIONS = [
  { value: "seek_inbound", label: "Seek [S]" },
  { value: "company_website", label: "Website [CSEG]" },
  { value: "database_internal", label: "Internal [DB]" },
  { value: "seek_talent", label: "Seek Talent [ST]" },
  { value: "linkedin", label: "LinkedIn [LI]" },
]

interface Props {
  appId: string
  initialNotes: string
  initialSourceChannel: string
}

export function EditApplicationDialog({ appId, initialNotes, initialSourceChannel }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notes, setNotes] = useState(initialNotes)
  const [sourceChannel, setSourceChannel] = useState(initialSourceChannel)

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/recruitment/applications/${appId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes, source_channel: sourceChannel }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        toast.error(typeof err?.error === "string" ? err.error : "Failed to save changes")
        return
      }
      toast.success("Application updated")
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
          <DialogTitle>Edit Application</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Source</label>
            <Select value={sourceChannel} onValueChange={setSourceChannel}>
              <SelectTrigger className="text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOURCE_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value} className="text-sm">{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes about this application"
              rows={4}
              className="w-full text-sm rounded-md border border-input bg-background px-3 py-2 resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
