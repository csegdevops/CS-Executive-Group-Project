"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Pencil } from "lucide-react"
import { toast } from "sonner"

interface LookupValue { value: string; label: string }

interface Props {
  candidateId: string
  initialTags: string[]
}

export function CandidateSkillsEditor({ candidateId, initialTags }: Props) {
  const router   = useRouter()
  const [open, setOpen]     = useState(false)
  const [allTags, setAllTags] = useState<LookupValue[]>([])
  const [selected, setSelected] = useState<string[]>(initialTags)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    fetch("/api/lookup-values?scope=recruitment&category=skill_tag")
      .then(r => r.json())
      .then(d => setAllTags(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [open])

  function toggle(v: string) {
    setSelected(prev => prev.includes(v) ? prev.filter(t => t !== v) : [...prev, v])
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/recruitment/candidates/${candidateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skills_tags: selected }),
      })
      if (!res.ok) { toast.error("Failed to save"); return }
      toast.success("Skills updated")
      setOpen(false)
      router.refresh()
    } finally { setSaving(false) }
  }

  const displayTags = initialTags.length > 0 ? initialTags : []

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Skills & Tags</span>
        <Button size="sm" variant="ghost" className="h-6 px-2 gap-1 text-xs" onClick={() => setOpen(true)}>
          <Pencil className="h-3 w-3" />Edit
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {displayTags.length > 0 ? (
          displayTags.map(tag => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {/* Try to find label from loaded tags, else format the value */}
              {tag.replace(/_/g, " ")}
            </Badge>
          ))
        ) : (
          <span className="text-xs text-muted-foreground">No skills tagged yet.</span>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Edit skills &amp; tags</DialogTitle></DialogHeader>
          <div className="py-2">
            <p className="text-xs text-muted-foreground mb-3">Select all that apply. These tags power the candidate search.</p>
            <div className="flex flex-wrap gap-2">
              {allTags.map(t => {
                const on = selected.includes(t.value)
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
            </div>
            {selected.length > 0 && (
              <p className="text-xs text-muted-foreground mt-3">{selected.length} selected</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
