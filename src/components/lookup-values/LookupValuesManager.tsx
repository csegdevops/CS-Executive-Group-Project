"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Plus, Pencil, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import type { LookupScope } from "@/types/database"

export interface LookupValueRow {
  id: string
  scope: LookupScope
  category: string
  value: string
  label: string
  sort_order: number
  is_active: boolean
}

const CATEGORY_LABELS: Record<string, string> = {
  company_industry:         "Company Industries",
  security_clearance_level: "Security Clearance Levels",
  employment_type:          "Employment Types",
  skill_tag:                "Candidate Skills & Tags",
  timesheet_category:       "Timesheet Categories",
  pay_code:                 "Pay Codes",
}

const SCOPE_LABELS: Record<string, string> = {
  global:      "Global",
  recruitment: "Recruitment",
  regulatory:  "Regulatory",
  timesheets:  "Timesheets",
  crm:         "CRM",
}

interface Props {
  initialValues: LookupValueRow[]
  visibleScopes: LookupScope[]       // which scopes this module page shows
  moduleScope: LookupScope | null    // the module this page belongs to (null = super-admin only page)
}

interface FormState {
  label: string
  value: string
  sort_order: string
}

export function LookupValuesManager({ initialValues, visibleScopes, moduleScope }: Props) {
  const router = useRouter()
  const [values, setValues] = useState<LookupValueRow[]>(initialValues)
  const [isPending, startTransition] = useTransition()
  const [activeScope, setActiveScope] = useState<LookupScope>(visibleScopes[0])

  // Dialog state
  const [addDialog, setAddDialog] = useState<{ open: boolean; scope: LookupScope; category: string } | null>(null)
  const [editDialog, setEditDialog] = useState<LookupValueRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<LookupValueRow | null>(null)
  const [form, setForm] = useState<FormState>({ label: "", value: "", sort_order: "0" })
  const [saving, setSaving] = useState(false)

  // Group values by scope → category
  const grouped = visibleScopes.reduce<Record<string, Record<string, LookupValueRow[]>>>(
    (acc, scope) => {
      acc[scope] = {}
      return acc
    },
    {}
  )
  for (const v of values) {
    if (!grouped[v.scope]) continue
    if (!grouped[v.scope][v.category]) grouped[v.scope][v.category] = []
    grouped[v.scope][v.category].push(v)
  }

  function openAdd(scope: LookupScope, category: string) {
    setForm({ label: "", value: "", sort_order: String(values.filter(v => v.scope === scope && v.category === category).length * 10 + 10) })
    setAddDialog({ open: true, scope, category })
  }

  function openEdit(row: LookupValueRow) {
    setForm({ label: row.label, value: row.value, sort_order: String(row.sort_order) })
    setEditDialog(row)
  }

  async function handleAdd() {
    if (!addDialog) return
    setSaving(true)
    try {
      const res = await fetch("/api/lookup-values", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: addDialog.scope,
          category: addDialog.category,
          value: form.value.trim().toLowerCase().replace(/\s+/g, "_"),
          label: form.label.trim(),
          sort_order: parseInt(form.sort_order) || 0,
        }),
      })
      if (res.status === 409) { toast.error("A value with that key already exists"); return }
      if (!res.ok) { toast.error("Failed to add value"); return }
      const created: LookupValueRow = await res.json()
      setValues(prev => [...prev, created])
      setAddDialog(null)
      toast.success(`"${created.label}" added`)
      startTransition(() => router.refresh())
    } finally {
      setSaving(false)
    }
  }

  async function handleEdit() {
    if (!editDialog) return
    setSaving(true)
    try {
      const res = await fetch(`/api/lookup-values/${editDialog.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: form.label.trim(),
          sort_order: parseInt(form.sort_order) || 0,
        }),
      })
      if (!res.ok) { toast.error("Failed to update"); return }
      const updated: LookupValueRow = await res.json()
      setValues(prev => prev.map(v => v.id === updated.id ? updated : v))
      setEditDialog(null)
      toast.success("Updated")
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActive(row: LookupValueRow) {
    const res = await fetch(`/api/lookup-values/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !row.is_active }),
    })
    if (!res.ok) { toast.error("Failed to update"); return }
    const updated: LookupValueRow = await res.json()
    setValues(prev => prev.map(v => v.id === updated.id ? updated : v))
    toast.success(updated.is_active ? "Enabled" : "Disabled")
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setSaving(true)
    try {
      const res = await fetch(`/api/lookup-values/${deleteTarget.id}`, { method: "DELETE" })
      if (!res.ok) { toast.error("Failed to delete"); return }
      setValues(prev => prev.filter(v => v.id !== deleteTarget.id))
      setDeleteTarget(null)
      toast.success(`"${deleteTarget.label}" removed`)
    } finally {
      setSaving(false)
    }
  }

  // Derive unique categories across all visible scopes from current + any new ones
  const categoriesByScope: Record<string, string[]> = {}
  for (const scope of visibleScopes) {
    categoriesByScope[scope] = Array.from(
      new Set(values.filter(v => v.scope === scope).map(v => v.category))
    )
  }

  const activeCats = categoriesByScope[activeScope] ?? []

  return (
    <div>
      {/* Scope tabs */}
      <div className="flex gap-1 border-b mb-6">
        {visibleScopes.map(scope => (
          <button
            key={scope}
            onClick={() => setActiveScope(scope)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              activeScope === scope
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {SCOPE_LABELS[scope] ?? scope}
          </button>
        ))}
      </div>

      {/* Categories for active scope */}
      <div className="space-y-4">
        {activeCats.length === 0 && (
          <p className="text-sm text-muted-foreground py-8 text-center border rounded-lg">
            No reference data configured for this scope yet.
          </p>
        )}
        {activeCats.map(category => {
          const rows = (grouped[activeScope]?.[category] ?? []).sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label))
          return (
            <div key={category} className="rounded-lg border bg-card">
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <h3 className="font-medium text-sm">
                  {CATEGORY_LABELS[category] ?? category}
                </h3>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1.5 text-xs"
                  onClick={() => openAdd(activeScope, category)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </Button>
              </div>
              <div className="divide-y">
                {rows.length === 0 && (
                  <p className="px-4 py-3 text-sm text-muted-foreground">No values yet.</p>
                )}
                {rows.map(row => (
                  <div key={row.id} className="flex items-center justify-between px-4 py-2.5 group">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-sm truncate ${!row.is_active ? "text-muted-foreground line-through" : ""}`}>
                        {row.label}
                      </span>
                      <span className="text-xs text-muted-foreground/60 font-mono hidden sm:block">
                        {row.value}
                      </span>
                      {!row.is_active && (
                        <Badge variant="outline" className="text-xs py-0 h-5">disabled</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(row)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground"
                        onClick={() => handleToggleActive(row)}
                      >
                        <span className="text-xs font-medium">{row.is_active ? "off" : "on"}</span>
                      </Button>
                      <Button
                        size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(row)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Add dialog */}
      <Dialog open={!!addDialog} onOpenChange={open => !open && setAddDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Add to {addDialog ? (CATEGORY_LABELS[addDialog.category] ?? addDialog.category) : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="add-label">Display label</Label>
              <Input
                id="add-label"
                placeholder="e.g. Information Technology"
                value={form.label}
                onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && handleAdd()}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-value">Key <span className="text-muted-foreground text-xs">(auto-generated, editable)</span></Label>
              <Input
                id="add-value"
                placeholder="e.g. information_technology"
                value={form.value}
                onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-sort">Sort order</Label>
              <Input
                id="add-sort"
                type="number"
                value={form.sort_order}
                onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialog(null)}>Cancel</Button>
            <Button
              onClick={handleAdd}
              disabled={!form.label.trim() || !form.value.trim() || saving}
            >
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editDialog} onOpenChange={open => !open && setEditDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit value</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-label">Display label</Label>
              <Input
                id="edit-label"
                value={form.label}
                onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && handleEdit()}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Key <span className="text-muted-foreground text-xs">(read-only)</span></Label>
              <Input value={editDialog?.value ?? ""} disabled className="font-mono text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-sort">Sort order</Label>
              <Input
                id="edit-sort"
                type="number"
                value={form.sort_order}
                onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(null)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={!form.label.trim() || saving}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete &quot;{deleteTarget?.label}&quot;?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            This permanently removes the value. Any existing records using it will keep their stored text but it won&apos;t appear in dropdowns.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
