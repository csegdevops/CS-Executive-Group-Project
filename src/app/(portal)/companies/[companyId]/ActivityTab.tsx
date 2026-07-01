"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Phone, Mail, Users, FileText, Plus } from "lucide-react"
import { toast } from "sonner"
import { formatDistanceToNow } from "@/lib/date-helpers"

interface Activity {
  id: string
  activity_type: "call" | "email" | "meeting" | "note"
  subject: string
  body: string | null
  occurred_at: string
  performer_name: string | null
  contact_name: string | null
  linked_module: string | null
  linked_record_id: string | null
}

interface Contact {
  id: string
  first_name: string
  last_name: string
}

interface Props {
  companyId: string
  initialActivities: Activity[]
  contacts: Contact[]
  currentUserName: string | null
}

const TYPE_ICONS = {
  call: Phone,
  email: Mail,
  meeting: Users,
  note: FileText,
} as const

const TYPE_COLORS: Record<string, string> = {
  call:    "bg-green-100 text-green-700",
  email:   "bg-blue-100 text-blue-700",
  meeting: "bg-purple-100 text-purple-700",
  note:    "bg-amber-100 text-amber-700",
}

export function ActivityTab({ companyId, initialActivities, contacts, currentUserName }: Props) {
  const [activities, setActivities] = useState<Activity[]>(initialActivities)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    activity_type: "call" as Activity["activity_type"],
    subject: "",
    body: "",
    contact_id: "",
  })

  function setF(k: keyof typeof form, v: string) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function handleLog() {
    if (!form.subject) return
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        activity_type: form.activity_type,
        subject: form.subject.trim(),
        body: form.body.trim() || null,
        contact_id: form.contact_id || null,
      }
      const res = await fetch(`/api/companies/${companyId}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) { toast.error("Failed to log activity"); return }
      const created: Activity = await res.json()
      const enriched = { ...created, performer_name: currentUserName, contact_name: contacts.find(c => c.id === form.contact_id) ? `${contacts.find(c => c.id === form.contact_id)!.first_name} ${contacts.find(c => c.id === form.contact_id)!.last_name}` : null }
      setActivities(prev => [enriched, ...prev])
      setForm({ activity_type: "call", subject: "", body: "", contact_id: "" })
      setShowForm(false)
      toast.success("Activity logged")
    } finally { setSaving(false) }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">{activities.length} activit{activities.length !== 1 ? "ies" : "y"}</p>
        <Button size="sm" onClick={() => setShowForm(v => !v)} className="gap-1.5">
          <Plus className="h-4 w-4" />Log Activity
        </Button>
      </div>

      {showForm && (
        <div className="border rounded-lg p-4 mb-4 space-y-3 bg-muted/30">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.activity_type} onValueChange={v => setF("activity_type", v as Activity["activity_type"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="call">Call</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="note">Note</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Contact (optional)</Label>
              <Select value={form.contact_id} onValueChange={v => setF("contact_id", v)}>
                <SelectTrigger><SelectValue placeholder="Select contact" /></SelectTrigger>
                <SelectContent>
                  {contacts.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Subject *</Label>
            <Input value={form.subject} onChange={e => setF("subject", e.target.value)} placeholder="Brief description" />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <textarea
              rows={3}
              value={form.body}
              onChange={e => setF("body", e.target.value)}
              placeholder="Details, follow-ups, outcomes…"
              className="w-full text-sm rounded-md border border-border bg-background px-3 py-2 resize-y focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button size="sm" onClick={handleLog} disabled={!form.subject || saving}>Log</Button>
          </div>
        </div>
      )}

      {activities.length === 0 && !showForm && (
        <div className="border rounded-lg text-center py-12 text-muted-foreground text-sm">
          No activities logged yet.
        </div>
      )}

      <div className="space-y-2">
        {activities.map(a => {
          const Icon = TYPE_ICONS[a.activity_type]
          return (
            <div key={a.id} className="flex gap-3 border rounded-lg px-4 py-3">
              <div className={`mt-0.5 p-1.5 rounded-md shrink-0 ${TYPE_COLORS[a.activity_type]}`}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium text-sm">{a.subject}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{formatDistanceToNow(a.occurred_at)}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {a.performer_name ?? "Unknown"}{a.contact_name ? ` · with ${a.contact_name}` : ""}
                </div>
                {a.body && <p className="text-sm text-foreground/80 mt-1 whitespace-pre-wrap">{a.body}</p>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
