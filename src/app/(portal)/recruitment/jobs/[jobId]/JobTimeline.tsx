"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { MessageSquarePlus } from "lucide-react"
import { toast } from "sonner"

const EVENT_LABELS: Record<string, string> = {
  opened:  "Job opened",
  posted:  "Posted to Seek",
  active:  "Set to Active",
  paused:  "Paused",
  filled:  "Filled",
  closed:  "Closed",
  note:    "Note added",
}

const EVENT_COLORS: Record<string, string> = {
  opened:  "bg-slate-400",
  posted:  "bg-blue-400",
  active:  "bg-green-400",
  paused:  "bg-amber-400",
  filled:  "bg-purple-400",
  closed:  "bg-red-400",
  note:    "bg-muted-foreground/40",
}

interface JobEvent {
  id: string
  event_type: string
  notes: string | null
  created_at: string
  performer_name: string | null
}

export function JobTimeline({ events, jobId }: { events: JobEvent[]; jobId: string }) {
  const router = useRouter()
  const [noteText, setNoteText] = useState("")
  const [saving, setSaving] = useState(false)

  async function addNote() {
    if (!noteText.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/recruitment/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: noteText.trim() }),
      })
      if (!res.ok) { toast.error("Failed to add note"); return }
      setNoteText("")
      toast.success("Note added")
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-xl space-y-4">
      {/* Add note */}
      <div className="flex gap-2">
        <textarea
          value={noteText}
          onChange={e => setNoteText(e.target.value)}
          placeholder="Add a note or update to this job…"
          rows={2}
          className="flex-1 text-sm rounded-md border border-border bg-background px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
          onKeyDown={e => { if (e.key === "Enter" && e.metaKey) addNote() }}
        />
        <Button size="sm" variant="outline" onClick={addNote} disabled={!noteText.trim() || saving} className="self-end gap-1.5">
          <MessageSquarePlus className="h-3.5 w-3.5" />
          Add
        </Button>
      </div>

      {/* Events */}
      <div className="relative">
        <div className="absolute left-3.5 top-0 bottom-0 w-px bg-border" />
        <div className="space-y-4">
          {events.length === 0 && (
            <p className="text-sm text-muted-foreground pl-10">No events yet.</p>
          )}
          {events.map(event => (
            <div key={event.id} className="flex gap-4 relative">
              <div className={cn("h-3 w-3 rounded-full mt-1.5 shrink-0 ring-2 ring-background z-10", EVENT_COLORS[event.event_type] ?? "bg-muted")} />
              <div className="flex-1 pb-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-medium">{EVENT_LABELS[event.event_type] ?? event.event_type}</p>
                  <p className="text-xs text-muted-foreground shrink-0">
                    {new Date(event.created_at).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                {event.performer_name && (
                  <p className="text-xs text-muted-foreground">{event.performer_name}</p>
                )}
                {event.notes && (
                  <p className="text-sm text-foreground/80 mt-1 whitespace-pre-wrap">{event.notes}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
