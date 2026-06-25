"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Trash2, StickyNote } from "lucide-react"
import { toast } from "sonner"

interface Note {
  id: string
  content: string
  author_id: string
  author_name: string
  created_at: string
}

export function NotesSection({ consultationId }: { consultationId: string }) {
  const [notes, setNotes]       = useState<Note[]>([])
  const [loading, setLoading]   = useState(true)
  const [content, setContent]   = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchNotes = useCallback(async () => {
    try {
      const res = await fetch(`/api/consultations/${consultationId}/notes`)
      if (res.ok) setNotes(await res.json())
    } finally {
      setLoading(false)
    }
  }, [consultationId])

  useEffect(() => { fetchNotes() }, [fetchNotes])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/consultations/${consultationId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim() }),
      })
      if (!res.ok) { toast.error("Failed to add note"); return }
      setContent("")
      await fetchNotes()
    } catch {
      toast.error("Network error")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(noteId: string) {
    setDeletingId(noteId)
    try {
      const res = await fetch(
        `/api/consultations/${consultationId}/notes?note_id=${noteId}`,
        { method: "DELETE" }
      )
      if (res.ok) setNotes((prev) => prev.filter((n) => n.id !== noteId))
      else toast.error("Failed to delete note")
    } catch {
      toast.error("Network error")
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <StickyNote className="h-4 w-4 text-muted-foreground" />
          Consultant Notes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="flex gap-2 items-end">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Add an internal note…"
            rows={2}
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
          />
          <Button type="submit" size="sm" disabled={submitting || !content.trim()}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
          </Button>
        </form>

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : notes.length === 0 ? (
          <p className="text-xs text-muted-foreground">No notes yet.</p>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => {
              const dt = new Date(note.created_at)
              return (
                <div key={note.id} className="bg-muted/40 rounded-md px-3 py-2.5 text-sm relative group">
                  <div className="flex items-baseline justify-between gap-2 mb-1">
                    <span className="font-medium text-xs">{note.author_name}</span>
                    <time className="text-xs text-muted-foreground">
                      {dt.toLocaleDateString()} {dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </time>
                  </div>
                  <p className="whitespace-pre-wrap text-muted-foreground">{note.content}</p>
                  <button
                    onClick={() => handleDelete(note.id)}
                    disabled={deletingId === note.id}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                    title="Delete note"
                  >
                    {deletingId === note.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Trash2 className="h-3.5 w-3.5" />
                    }
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
