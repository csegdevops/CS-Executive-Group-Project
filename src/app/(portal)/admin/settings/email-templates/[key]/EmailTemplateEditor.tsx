"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Loader2, Send } from "lucide-react"
import { toast } from "sonner"
import { substituteVariables, type EmailTemplateVariable } from "@/lib/email/template-registry"

// Relative path resolves fine in the browser preview; the actual send path
// (src/lib/email/send-templated.ts) uses an absolute NEXT_PUBLIC_BASE_URL
// version since email clients can't resolve relative image URLs.
const PREVIEW_LOGO_URL = "/cseg_logo_new.png"

interface TemplateData {
  subject: string
  body_html: string
  body_text: string
  cc_group_ids: string[]
  bcc_group_ids: string[]
}

interface Group {
  id: string
  name: string
}

const textareaClass =
  "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

function GroupPicker({
  title,
  groups,
  selected,
  onChange,
  disabled,
}: {
  title: string
  groups: Group[]
  selected: string[]
  onChange: (next: string[]) => void
  disabled: boolean
}) {
  function toggle(id: string) {
    if (disabled) return
    onChange(selected.includes(id) ? selected.filter((g) => g !== id) : [...selected, id])
  }

  return (
    <div className="space-y-1.5">
      <Label>{title}</Label>
      {groups.length === 0 ? (
        <p className="text-xs text-muted-foreground">No security groups exist yet.</p>
      ) : (
        <div className="border rounded-md p-2.5 space-y-1.5 max-h-40 overflow-y-auto">
          {groups.map((g) => (
            <label
              key={g.id}
              className={`flex items-center gap-2 text-sm ${disabled ? "cursor-not-allowed text-muted-foreground" : "cursor-pointer"}`}
            >
              <Checkbox checked={selected.includes(g.id)} disabled={disabled} onCheckedChange={() => toggle(g.id)} />
              {g.name}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

export function EmailTemplateEditor({
  templateKey,
  canEdit,
  initial,
  groups,
  variables,
  sampleValues,
}: {
  templateKey: string
  canEdit: boolean
  initial: TemplateData
  groups: Group[]
  variables: EmailTemplateVariable[]
  sampleValues: Record<string, string>
}) {
  const [subject, setSubject] = useState(initial.subject)
  const [bodyHtml, setBodyHtml] = useState(initial.body_html)
  const [bodyText, setBodyText] = useState(initial.body_text)
  const [ccGroupIds, setCcGroupIds] = useState<string[]>(initial.cc_group_ids ?? [])
  const [bccGroupIds, setBccGroupIds] = useState<string[]>(initial.bcc_group_ids ?? [])
  const [saving, setSaving] = useState(false)
  const [sendingTest, setSendingTest] = useState(false)

  const previewVars = { logoUrl: PREVIEW_LOGO_URL, ...sampleValues }
  const previewHtml = substituteVariables(bodyHtml, previewVars)
  const previewText = substituteVariables(bodyText, previewVars)

  const dirty =
    subject !== initial.subject ||
    bodyHtml !== initial.body_html ||
    bodyText !== initial.body_text ||
    JSON.stringify(ccGroupIds) !== JSON.stringify(initial.cc_group_ids ?? []) ||
    JSON.stringify(bccGroupIds) !== JSON.stringify(initial.bcc_group_ids ?? [])

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/email-templates/${templateKey}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          body_html: bodyHtml,
          body_text: bodyText,
          cc_group_ids: ccGroupIds,
          bcc_group_ids: bccGroupIds,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? "Failed to save template")
        return
      }
      toast.success("Template saved")
    } catch {
      toast.error("Network error")
    } finally {
      setSaving(false)
    }
  }

  async function handleSendTest() {
    setSendingTest(true)
    try {
      const res = await fetch(`/api/admin/email-templates/${templateKey}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body_html: bodyHtml, body_text: bodyText }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? "Failed to send test email")
        return
      }
      toast.success("Test email sent to you")
    } catch {
      toast.error("Network error")
    } finally {
      setSendingTest(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <Label>Available variables</Label>
        <div className="flex flex-wrap gap-1.5">
          {variables.map((v) => (
            <Badge key={v.name} variant="outline" className="font-mono text-xs" title={v.description}>
              {"{{"}{v.name}{"}}"}
            </Badge>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Subject</Label>
        <Input value={subject} onChange={(e) => setSubject(e.target.value)} disabled={!canEdit} />
      </div>

      <Tabs defaultValue="html">
        <TabsList>
          <TabsTrigger value="html">HTML</TabsTrigger>
          <TabsTrigger value="text">Text</TabsTrigger>
        </TabsList>

        <TabsContent value="html" className="mt-3">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Source</Label>
              <textarea
                value={bodyHtml}
                onChange={(e) => setBodyHtml(e.target.value)}
                disabled={!canEdit}
                rows={16}
                className={textareaClass}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Preview (with sample data)</Label>
              <iframe
                srcDoc={previewHtml}
                sandbox=""
                title="HTML preview"
                className="w-full rounded-md border bg-white"
                style={{ height: "20rem" }}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="text" className="mt-3">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Source</Label>
              <textarea
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                disabled={!canEdit}
                rows={16}
                className={textareaClass}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Preview (with sample data)</Label>
              <pre className="w-full rounded-md border p-3 text-sm whitespace-pre-wrap" style={{ height: "20rem", overflowY: "auto" }}>
                {previewText}
              </pre>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <p className="text-xs text-muted-foreground">
        The primary recipient is always resolved automatically (e.g. the assigned consultant or recruiter). Security
        groups below are added on top as CC or BCC.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <GroupPicker title="CC" groups={groups} selected={ccGroupIds} onChange={setCcGroupIds} disabled={!canEdit} />
        <GroupPicker title="BCC" groups={groups} selected={bccGroupIds} onChange={setBccGroupIds} disabled={!canEdit} />
      </div>

      {canEdit && (
        <div className="flex items-center justify-between pt-2 border-t">
          <Button type="button" variant="outline" size="sm" onClick={handleSendTest} disabled={sendingTest}>
            {sendingTest ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Send className="h-4 w-4 mr-1.5" />}
            Send test email to myself
          </Button>
          <Button type="button" size="sm" onClick={handleSave} disabled={saving || !dirty}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            Save
          </Button>
        </div>
      )}
    </div>
  )
}
