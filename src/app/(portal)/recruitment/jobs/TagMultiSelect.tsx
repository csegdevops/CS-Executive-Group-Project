"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Pencil, Search } from "lucide-react"

interface LookupValue { value: string; label: string }

interface Props {
  label: string
  scope: string
  category: string
  value: string[]
  onChange: (v: string[]) => void
  placeholder?: string
}

export function TagMultiSelect({ label, scope, category, value, onChange, placeholder }: Props) {
  const [open, setOpen] = useState(false)
  const [allTags, setAllTags] = useState<LookupValue[]>([])
  const [draft, setDraft] = useState<string[]>(value)
  const [q, setQ] = useState("")

  useEffect(() => {
    if (!open) return
    setDraft(value)
    setQ("")
    fetch(`/api/lookup-values?scope=${scope}&category=${category}`)
      .then((r) => r.json())
      .then((d) => setAllTags(Array.isArray(d) ? d : []))
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function toggle(v: string) {
    setDraft((prev) => (prev.includes(v) ? prev.filter((t) => t !== v) : [...prev, v]))
  }

  const labelFor = (v: string) => allTags.find((t) => t.value === v)?.label ?? v.replace(/_/g, " ")

  const filtered = q.trim()
    ? allTags.filter((t) => t.label.toLowerCase().includes(q.trim().toLowerCase()))
    : allTags

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium">{label}</span>
        <Button type="button" size="sm" variant="ghost" className="h-6 px-2 gap-1 text-xs" onClick={() => setOpen(true)}>
          <Pencil className="h-3 w-3" />Select
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5 min-h-6">
        {value.length > 0 ? (
          value.map((v) => <Badge key={v} variant="secondary" className="text-xs">{labelFor(v)}</Badge>)
        ) : (
          <span className="text-xs text-muted-foreground">{placeholder ?? "None selected"}</span>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col overflow-hidden">
          <DialogHeader><DialogTitle>{label}</DialogTitle></DialogHeader>
          <div className="relative shrink-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter…" className="pl-8" />
          </div>
          <div className="flex flex-wrap gap-2 overflow-y-auto py-1">
            {filtered.map((t) => {
              const on = draft.includes(t.value)
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => toggle(t.value)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    on
                      ? "bg-foreground text-background border-foreground"
                      : "bg-background text-foreground border-border hover:border-foreground"
                  }`}
                >
                  {t.label}
                </button>
              )
            })}
            {filtered.length === 0 && <p className="text-xs text-muted-foreground">No matches.</p>}
          </div>
          {draft.length > 0 && <p className="text-xs text-muted-foreground shrink-0">{draft.length} selected</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="button" onClick={() => { onChange(draft); setOpen(false) }}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
