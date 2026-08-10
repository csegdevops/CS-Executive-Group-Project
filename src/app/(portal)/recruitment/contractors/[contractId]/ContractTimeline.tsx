"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { MessageSquarePlus, CalendarPlus } from "lucide-react"
import { toast } from "sonner"

interface Extension {
  id: string
  previous_finish_date: string | null
  new_finish_date: string
  notes: string | null
  extended_at: string
}
interface SiblingRenewal {
  id: string
  contract_number: string | null
  start_date: string | null
  created_at: string
}
interface LeavePeriod {
  id: string
  start_date: string
  end_date: string | null
  reason: string | null
  created_at: string
}
interface ContractNote {
  id: string
  category: string
  note: string
  created_at: string
}

const NOTE_CATEGORIES: { value: string; label: string }[] = [
  { value: "compliance", label: "Compliance" },
  { value: "client_instruction", label: "Client instruction" },
  { value: "schedule", label: "Schedule" },
  { value: "rate_note", label: "Rate note" },
  { value: "other", label: "Other" },
]

type TimelineEntry = {
  id: string
  date: string
  color: string
  title: string
  subtitle?: string | null
}

function formatDate(d: string | null): string {
  return d ? new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "Ongoing"
}
function formatDateTime(d: string): string {
  return new Date(d).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
}

export function ContractTimeline({
  contractId, contractNumber, createdAt, currentContractId,
  extensions, siblingRenewals, leavePeriods, notes, terminatedAt, terminationReason, onSaved,
}: {
  contractId: string
  contractNumber: string | null
  createdAt: string
  currentContractId: string
  extensions: Extension[]
  siblingRenewals: SiblingRenewal[]
  leavePeriods: LeavePeriod[]
  notes: ContractNote[]
  terminatedAt: string | null
  terminationReason: string | null
  onSaved?: () => void
}) {
  const router = useRouter()
  const [noteText, setNoteText] = useState("")
  const [noteCategory, setNoteCategory] = useState("other")
  const [savingNote, setSavingNote] = useState(false)
  const [leaveStart, setLeaveStart] = useState("")
  const [leaveEnd, setLeaveEnd] = useState("")
  const [leaveReason, setLeaveReason] = useState("")
  const [savingLeave, setSavingLeave] = useState(false)

  async function addNote() {
    if (!noteText.trim()) return
    setSavingNote(true)
    try {
      const res = await fetch(`/api/recruitment/contracts/${contractId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: noteText.trim(), note_category: noteCategory }),
      })
      if (!res.ok) { toast.error("Failed to add update"); return }
      setNoteText("")
      toast.success("Update added")
      router.refresh()
      onSaved?.()
    } finally {
      setSavingNote(false)
    }
  }

  async function addLeave() {
    if (!leaveStart) return
    setSavingLeave(true)
    try {
      const res = await fetch(`/api/recruitment/contracts/${contractId}/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start_date: leaveStart, end_date: leaveEnd || null, reason: leaveReason || null }),
      })
      if (!res.ok) { toast.error("Failed to add leave period"); return }
      setLeaveStart(""); setLeaveEnd(""); setLeaveReason("")
      toast.success("Leave period added")
      router.refresh()
      onSaved?.()
    } finally {
      setSavingLeave(false)
    }
  }

  const entries: TimelineEntry[] = [
    { id: "created", date: createdAt, color: "bg-slate-400", title: `Contract started${contractNumber ? `: ${contractNumber}` : ""}` },
    ...extensions.map((e) => ({
      id: `ext-${e.id}`, date: e.extended_at, color: "bg-blue-400",
      title: `Extended to ${formatDate(e.new_finish_date)}`,
      subtitle: e.notes,
    })),
    ...siblingRenewals.map((s) => ({
      id: `renewal-${s.id}`, date: s.created_at, color: "bg-purple-400",
      title: s.id === currentContractId
        ? `Renewed from a previous contract`
        : `Renewed into ${s.contract_number ?? "a new contract"}`,
      subtitle: s.id !== currentContractId ? "View that contract via Contract history above" : undefined,
    })),
    ...leavePeriods.map((l) => ({
      id: `leave-${l.id}`, date: l.created_at, color: "bg-amber-400",
      title: `Leave recorded: ${formatDate(l.start_date)} – ${formatDate(l.end_date)}`,
      subtitle: l.reason,
    })),
    ...notes.map((n) => ({
      id: `note-${n.id}`, date: n.created_at, color: "bg-muted-foreground/40",
      title: NOTE_CATEGORIES.find((c) => c.value === n.category)?.label ?? n.category,
      subtitle: n.note,
    })),
    ...(terminatedAt ? [{
      id: "terminated", date: terminatedAt, color: "bg-red-400",
      title: "Contract terminated",
      subtitle: terminationReason,
    }] : []),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      <h3 className="font-medium text-sm">Updates</h3>

      {/* Add update */}
      <div className="flex gap-2">
        <Select value={noteCategory} onValueChange={setNoteCategory}>
          <SelectTrigger className="w-40 shrink-0"><SelectValue /></SelectTrigger>
          <SelectContent>
            {NOTE_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="Add an update to this contract…"
          rows={1}
          className="flex-1 text-sm rounded-md border border-border bg-background px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <Button size="sm" variant="outline" onClick={addNote} disabled={!noteText.trim() || savingNote} className="shrink-0 gap-1.5">
          <MessageSquarePlus className="h-3.5 w-3.5" />Add
        </Button>
      </div>

      {/* Add leave period */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Leave start</span>
          <Input type="date" className="h-8 w-36" value={leaveStart} onChange={(e) => setLeaveStart(e.target.value)} />
        </div>
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Leave end (optional)</span>
          <Input type="date" className="h-8 w-36" value={leaveEnd} onChange={(e) => setLeaveEnd(e.target.value)} />
        </div>
        <Input
          placeholder="Reason (optional)"
          className="h-8 flex-1 min-w-32"
          value={leaveReason}
          onChange={(e) => setLeaveReason(e.target.value)}
        />
        <Button size="sm" variant="outline" onClick={addLeave} disabled={!leaveStart || savingLeave} className="gap-1.5">
          <CalendarPlus className="h-3.5 w-3.5" />Add leave
        </Button>
      </div>

      {/* Timeline */}
      <div className="relative pt-1">
        <div className="absolute left-1.5 top-2 bottom-0 w-px bg-border" />
        <div className="space-y-4">
          {entries.map((entry) => (
            <div key={entry.id} className="flex gap-4 relative">
              <div className={cn("h-3 w-3 rounded-full mt-1.5 shrink-0 ring-2 ring-background z-10", entry.color)} />
              <div className="flex-1 pb-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-medium">{entry.title}</p>
                  <p className="text-xs text-muted-foreground shrink-0">{formatDateTime(entry.date)}</p>
                </div>
                {entry.subtitle && <p className="text-sm text-foreground/80 mt-1 whitespace-pre-wrap">{entry.subtitle}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
