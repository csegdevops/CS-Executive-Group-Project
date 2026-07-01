"use client"

import { useState, useEffect, useRef } from "react"
import { CheckCircle2, Circle, Loader2, MessageSquare, Plus, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

interface LogEntry {
  id: string
  action: string
  details: Record<string, unknown> | null
  created_at: string
  user_name: string | null
}

interface NoteEntry {
  id: string
  content: string
  author_id: string
  author_name: string
  created_at: string
  milestone: MilestoneKey | null
}

type MilestoneKey = "consultation" | "chemicals" | "volumes" | "regulatory" | "review" | "complete"

function getMilestone(action: string, details: Record<string, unknown> | null): MilestoneKey {
  switch (action) {
    case "chemicals_added":
    case "chemical_removed":
    case "chemical_resolved":
    case "chemical_pushed_to_db":
    case "chemical_reassigned":
      return "chemicals"

    case "details_updated": {
      if ((details?.field as string | undefined) === "status") {
        const next = (details?.new as string | undefined) ?? ""
        if (next === "completed")    return "complete"
        if (next === "under_review") return "review"
      }
      return "consultation"
    }

    case "status_changed": {
      const s = (details?.new_status as string | undefined) ?? ""
      if (s === "completed")    return "complete"
      if (s === "under_review") return "review"
      return "consultation"
    }

    default:
      return "consultation"
  }
}

function describeLog(action: string, details: Record<string, unknown> | null): string {
  switch (action) {
    case "created": return "Consultation created"
    case "chemicals_added": {
      const added      = Number(details?.added ?? 0)
      const unresolved = Number(details?.unresolved ?? 0)
      const skipped    = Number(details?.skipped ?? 0)
      const parts = [`${added} ingredient${added !== 1 ? "s" : ""} added`]
      if (unresolved > 0) parts.push(`${unresolved} unresolved`)
      if (skipped > 0)    parts.push(`${skipped} skipped`)
      return parts.join(", ")
    }
    case "chemical_removed":      return "Removed an ingredient"
    case "chemical_resolved":     return "Resolved an unresolved ingredient"
    case "chemical_pushed_to_db": return "Pushed ingredient to global database (pending review)"
    case "chemical_reassigned": {
      const from = details?.from ? `"${details.from}"` : "(no product)"
      const to   = details?.to   ? `"${details.to}"`   : "(no product)"
      return `Moved ingredient from ${from} to ${to}`
    }
    case "details_updated": {
      if ((details?.field as string | undefined) === "status") {
        const fmtStatus = (s: unknown) => String(s ?? "").replace(/_/g, " ")
        return `Status changed from "${fmtStatus(details?.old)}" to "${fmtStatus(details?.new)}"`
      }
      const field = String(details?.field ?? "field").replace(/_/g, " ")
      const fmt = (v: unknown) =>
        v == null || v === "" ? "—" : Array.isArray(v) ? (v as string[]).join(", ") : String(v)
      return `Updated ${field}: ${fmt(details?.old)} → ${fmt(details?.new)}`
    }
    case "consultant_assigned": return "Consultant assigned"
    case "consultant_removed":  return "Consultant removed"
    case "status_changed": {
      const s = String(details?.new_status ?? "").replace(/_/g, " ")
      return `Status changed to "${s}"`
    }
    default: return action.replace(/_/g, " ")
  }
}

interface ChecklistState {
  chemicalsAdded: boolean
  volumesEntered: boolean
  regulatoryAssessed: boolean
  sentForReview: boolean
  complete: boolean
}

interface Props {
  consultationId: string
  checklist: ChecklistState
  chemicalsSummary: string
  volumesSummary: string
  regulatorySummary: string
  currentUserId: string
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-AU", {
    day: "numeric", month: "short", year: "numeric",
  })
}

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString("en-AU", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

export function TimelineTab({
  consultationId,
  checklist,
  chemicalsSummary,
  volumesSummary,
  regulatorySummary,
  currentUserId,
}: Props) {
  const [logs, setLogs]     = useState<LogEntry[]>([])
  const [notes, setNotes]   = useState<NoteEntry[]>([])
  const [loading, setLoading] = useState(true)

  // Per-milestone note input state
  const [addingNote, setAddingNote] = useState<MilestoneKey | null>(null)
  const [noteText, setNoteText]     = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [deletingNote, setDeletingNote] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    Promise.all([
      fetch(`/api/consultations/${consultationId}/logs`).then((r) => r.ok ? r.json() : []),
      fetch(`/api/consultations/${consultationId}/notes`).then((r) => r.ok ? r.json() : []),
    ])
      .then(([logData, noteData]: [LogEntry[], NoteEntry[]]) => {
        setLogs([...logData].reverse())
        setNotes(noteData)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [consultationId])

  // Focus textarea when a note box opens
  useEffect(() => {
    if (addingNote) textareaRef.current?.focus()
  }, [addingNote])

  function openNote(key: MilestoneKey) {
    setAddingNote(key)
    setNoteText("")
  }

  function cancelNote() {
    setAddingNote(null)
    setNoteText("")
  }

  async function submitNote(milestone: MilestoneKey) {
    if (!noteText.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/consultations/${consultationId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: noteText.trim(), milestone }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? "Failed to add note")
        return
      }
      const saved = await res.json()
      setNotes((prev) => [
        { ...saved, author_name: saved.author_name ?? "You", milestone: saved.milestone ?? "consultation" },
        ...prev,
      ])
      setAddingNote(null)
      setNoteText("")
      toast.success("Note added")
    } catch {
      toast.error("Network error")
    } finally {
      setSubmitting(false)
    }
  }

  async function deleteNote(noteId: string) {
    setDeletingNote(noteId)
    try {
      const res = await fetch(
        `/api/consultations/${consultationId}/notes?note_id=${noteId}`,
        { method: "DELETE" }
      )
      if (res.ok) {
        setNotes((prev) => prev.filter((n) => n.id !== noteId))
        toast.success("Note deleted")
      } else {
        const err = await res.json()
        toast.error(err.error ?? "Failed to delete note")
      }
    } catch {
      toast.error("Network error")
    } finally {
      setDeletingNote(null)
    }
  }

  interface Milestone {
    key: MilestoneKey
    label: string
    done: boolean
    summary?: string
    noLogs?: true
  }

  const milestones: Milestone[] = [
    { key: "consultation", label: "Consultation created",        done: true },
    { key: "chemicals",    label: "Chemicals",                    done: checklist.chemicalsAdded,     summary: chemicalsSummary },
    { key: "volumes",      label: "Volumes entered",              done: checklist.volumesEntered,     summary: volumesSummary,    noLogs: true },
    { key: "regulatory",   label: "Regulatory status assessed",  done: checklist.regulatoryAssessed,  summary: regulatorySummary, noLogs: true },
    { key: "review",       label: "Sent for review",              done: checklist.sentForReview },
    { key: "complete",     label: "Assessment complete",          done: checklist.complete },
  ]

  // Group logs by milestone key (skip note_added — shown as NoteEntry instead)
  const groupedLogs = new Map<MilestoneKey, LogEntry[]>()
  for (const log of logs) {
    if (log.action === "note_added") continue
    const key = getMilestone(log.action, log.details)
    const arr = groupedLogs.get(key) ?? []
    arr.push(log)
    groupedLogs.set(key, arr)
  }

  // Group notes by their milestone (null → "consultation")
  const groupedNotes = new Map<MilestoneKey, NoteEntry[]>()
  for (const note of notes) {
    const key: MilestoneKey = note.milestone ?? "consultation"
    const arr = groupedNotes.get(key) ?? []
    arr.push(note)
    groupedNotes.set(key, arr)
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      {milestones.map((m, i) => {
        const entries   = m.noLogs ? [] : (groupedLogs.get(m.key) ?? [])
        const milNotes  = groupedNotes.get(m.key) ?? []
        const isLast    = i === milestones.length - 1
        const firstDate = entries[0]?.created_at

        return (
          <div key={m.key} className="flex gap-4">
            {/* Left: icon + connector line */}
            <div className="flex flex-col items-center w-5 shrink-0">
              {m.done
                ? <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                : <Circle       className="h-5 w-5 text-muted-foreground/30 shrink-0 mt-0.5" />
              }
              {!isLast && (
                <div className="w-px flex-1 bg-border mt-1 min-h-[2rem]" />
              )}
            </div>

            {/* Right: milestone heading + log entries + notes */}
            <div className={`pb-6 flex-1 min-w-0 ${!m.done ? "opacity-40" : ""}`}>
              <div className="flex items-baseline gap-2 mt-0.5">
                <p className="text-sm font-semibold leading-5">{m.label}</p>
                {firstDate && (
                  <span className="text-xs text-muted-foreground">{fmtDate(firstDate)}</span>
                )}
                {m.done && (
                  <button
                    type="button"
                    onClick={() => addingNote === m.key ? cancelNote() : openNote(m.key)}
                    className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    title="Add a note to this milestone"
                  >
                    {addingNote === m.key
                      ? <><X className="h-3 w-3" /> Cancel</>
                      : <><Plus className="h-3 w-3" /> Note</>
                    }
                  </button>
                )}
              </div>

              {m.summary && (
                <p className="text-xs text-muted-foreground mt-0.5">{m.summary}</p>
              )}

              {/* Log entries */}
              {entries.length > 0 && (
                <ul className="mt-2 space-y-1.5">
                  {entries.map((log) => (
                    <li key={log.id} className="flex items-baseline gap-2 text-xs text-muted-foreground">
                      <span className="mt-[5px] h-1 w-1 rounded-full bg-muted-foreground/40 shrink-0" />
                      <span className="min-w-0">
                        {log.user_name && (
                          <span className="font-medium text-foreground/70">{log.user_name} · </span>
                        )}
                        {describeLog(log.action, log.details)}
                        <span className="ml-2 text-muted-foreground/50">{fmtDate(log.created_at)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {/* Notes */}
              {milNotes.length > 0 && (
                <div className="mt-2 space-y-2">
                  {milNotes.map((note) => (
                    <div
                      key={note.id}
                      className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs group relative"
                    >
                      <div className="flex items-center gap-1 text-muted-foreground mb-1">
                        <MessageSquare className="h-3 w-3 shrink-0" />
                        <span className="font-medium text-foreground/70">{note.author_name}</span>
                        <span>·</span>
                        <span>{fmtDateTime(note.created_at)}</span>
                        {note.author_id === currentUserId && (
                          <button
                            type="button"
                            onClick={() => deleteNote(note.id)}
                            disabled={deletingNote === note.id}
                            className="ml-auto opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                            title="Delete note"
                          >
                            {deletingNote === note.id
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : <Trash2 className="h-3 w-3" />
                            }
                          </button>
                        )}
                      </div>
                      <p className="whitespace-pre-wrap text-foreground/80 leading-relaxed">{note.content}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Inline note composer */}
              {addingNote === m.key && (
                <div className="mt-2 space-y-1.5">
                  <textarea
                    ref={textareaRef}
                    value={noteText}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNoteText(e.target.value)}
                    placeholder={`Add a note to "${m.label}"…`}
                    rows={3}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs resize-none placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitNote(m.key)
                      if (e.key === "Escape") cancelNote()
                    }}
                  />
                  <div className="flex gap-1.5 items-center">
                    <Button
                      size="sm"
                      className="h-7 text-xs"
                      disabled={!noteText.trim() || submitting}
                      onClick={() => submitNote(m.key)}
                    >
                      {submitting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                      Save note
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={cancelNote}
                    >
                      Cancel
                    </Button>
                    <span className="text-xs text-muted-foreground/60 ml-1">⌘↵ to save · Esc to cancel</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
