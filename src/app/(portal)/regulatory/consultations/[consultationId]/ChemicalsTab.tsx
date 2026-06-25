"use client"

import { useState, useCallback, useEffect, Fragment } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { RegulatoryStatusBadge } from "@/components/chemicals/RegulatoryStatusBadge"
import { Plus, Trash2, AlertCircle, Loader2, Link2, X, GripVertical } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import { UploadFormulationDialog } from "./UploadFormulationDialog"
import { PushToDbDialog } from "./PushToDbDialog"
import type { RegulatoryFramework, RegulatoryStatus } from "@/types/database"

interface SearchResult {
  id: string
  cas_number: string | null
  common_name: string
  iupac_name: string | null
  needs_review: boolean
}

interface Chemical {
  id: string
  cas_number: string | null
  common_name: string
  iupac_name: string | null
  molecular_formula: string | null
  needs_review: boolean
  regulatory_listings: { id?: string; framework: string; status: string }[]
}

interface ConsultationChemical {
  id: string
  chemical_id: string | null
  role: string | null
  quantity: number | null
  unit: string | null
  notes: string | null
  product_name: string | null
  alt_cas: string | null
  added_at: string
  chemicals: Chemical | null
}

interface Props {
  consultationId: string
  frameworks: RegulatoryFramework[]
  initialChemicals: ConsultationChemical[]
  products: string[]
}

export function ChemicalsTab({ consultationId, frameworks, initialChemicals, products }: Props) {
  const router = useRouter()
  const [chemicals, setChemicals] = useState<ConsultationChemical[]>(initialChemicals)
  const [identifier, setIdentifier] = useState("")
  const [role, setRole]             = useState("")
  const [productName, setProductName]  = useState("")
  const [concentration, setConcentration] = useState("")
  const [adding, setAdding]           = useState(false)
  const [removing, setRemoving]       = useState<string | null>(null)

  // Resolve (link unresolved → known chemical)
  const [resolvingId, setResolvingId]         = useState<string | null>(null)
  const [resolveQuery, setResolveQuery]       = useState("")
  const [resolveResults, setResolveResults]   = useState<SearchResult[]>([])
  const [resolveSearching, setResolveSearching] = useState(false)
  const [resolveApplying, setResolveApplying]   = useState(false)

  // Drag-and-drop to reassign product
  const [dragId, setDragId]     = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)

  useEffect(() => {
    if (!resolveQuery.trim() || resolveQuery.length < 2) {
      setResolveResults([])
      return
    }
    const t = setTimeout(async () => {
      setResolveSearching(true)
      try {
        const res = await fetch(`/api/chemicals?q=${encodeURIComponent(resolveQuery)}`)
        if (res.ok) setResolveResults(await res.json())
      } finally {
        setResolveSearching(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [resolveQuery])

  function startResolve(ccId: string) {
    setResolvingId(ccId)
    setResolveQuery("")
    setResolveResults([])
  }

  async function handleResolveApply(ccId: string, chemicalId: string) {
    setResolveApplying(true)
    try {
      const res = await fetch(`/api/consultations/${consultationId}/chemicals`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: ccId, chemical_id: chemicalId }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? "Failed to resolve")
        return
      }
      setResolvingId(null)
      setResolveQuery("")
      setResolveResults([])
      await refreshList()
      toast.success("Chemical resolved")
    } catch {
      toast.error("Network error")
    } finally {
      setResolveApplying(false)
    }
  }

  const refreshList = useCallback(async () => {
    const res = await fetch(`/api/consultations/${consultationId}/chemicals`)
    if (res.ok) setChemicals(await res.json())
    router.refresh()
  }, [consultationId, router])

  async function handleAdd(e: { preventDefault(): void }) {
    e.preventDefault()
    if (!identifier.trim()) return
    setAdding(true)
    const isCas = /^\d{2,7}-\d{2}-\d$/.test(identifier.trim())
    const qty   = concentration.trim() ? parseFloat(concentration) : undefined
    const body  = isCas
      ? { cas: identifier.trim(), role: role || undefined, product_name: productName || undefined, quantity: qty }
      : { name: identifier.trim(), role: role || undefined, product_name: productName || undefined, quantity: qty }
    try {
      const res = await fetch(`/api/consultations/${consultationId}/chemicals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? "Failed to add chemical")
        return
      }
      await refreshList()
      setIdentifier("")
      setRole("")
      setProductName("")
      setConcentration("")
      toast.success("Chemical added")
    } catch {
      toast.error("Network error")
    } finally {
      setAdding(false)
    }
  }

  async function handleRemove(cc: ConsultationChemical) {
    setRemoving(cc.id)
    try {
      const res = await fetch(
        `/api/consultations/${consultationId}/chemicals?id=${cc.id}`,
        { method: "DELETE" }
      )
      if (res.ok) {
        setChemicals((prev) => prev.filter((x) => x.id !== cc.id))
        toast.success("Removed")
      } else {
        toast.error("Failed to remove")
      }
    } catch {
      toast.error("Network error")
    } finally {
      setRemoving(null)
    }
  }

  // ── Drag-and-drop handlers ────────────────────────────────────────────────

  function handleDragStart(e: React.DragEvent<HTMLTableRowElement>, cc: ConsultationChemical) {
    setDragId(cc.id)
    e.dataTransfer.effectAllowed = "move"
    // Custom drag ghost: just the chemical name on a small card
    const label = cc.chemicals?.common_name ?? cc.notes ?? "ingredient"
    const ghost = document.createElement("div")
    ghost.textContent = label
    ghost.style.cssText = [
      "position:fixed", "top:-100px", "background:white",
      "border:1px solid #e2e8f0", "border-radius:6px",
      "padding:4px 12px", "font-size:13px",
      "box-shadow:0 2px 8px rgba(0,0,0,.15)", "pointer-events:none",
      "white-space:nowrap",
    ].join(";")
    document.body.appendChild(ghost)
    e.dataTransfer.setDragImage(ghost, ghost.offsetWidth / 2, 14)
    requestAnimationFrame(() => document.body.removeChild(ghost))
  }

  function handleDragEnd() {
    setDragId(null)
    setDragOver(null)
  }

  async function handleDrop(targetGroupKey: string) {
    if (!dragId) return
    const id         = dragId  // capture before clearing
    const newProduct = targetGroupKey === "(no product)" ? "" : targetGroupKey
    const cc         = chemicals.find((c) => c.id === id)
    setDragId(null)
    setDragOver(null)
    if (!cc || (cc.product_name ?? "") === newProduct) return  // same group, no-op

    // Optimistic: move immediately in local state and clear stale concentration
    setChemicals((prev) =>
      prev.map((c) => c.id === id ? { ...c, product_name: newProduct, quantity: null, unit: null } : c)
    )

    try {
      const res = await fetch(`/api/consultations/${consultationId}/chemicals`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, product_name: newProduct }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? "Failed to move chemical")
        setChemicals((prev) => prev.map((c) => c.id === id ? cc : c))  // revert
        return
      }
      router.refresh()  // sync server components (VolumesTab etc.)
      toast.success("Chemical moved")
    } catch {
      toast.error("Network error")
      setChemicals((prev) => prev.map((c) => c.id === id ? cc : c))  // revert
    }
  }

  // ── Build group entries ────────────────────────────────────────────────────
  // During drag: surface all products (including empty ones) as drop targets.

  function needsAction(chem: Chemical): boolean {
    if (chem.needs_review) return true
    return chem.regulatory_listings.some(
      (rl) => rl.framework === "aicis" && rl.status === "restricted"
    )
  }

  const grouped = chemicals.reduce<Record<string, ConsultationChemical[]>>((acc, cc) => {
    const key = cc.product_name || "(no product)"
    ;(acc[key] ??= []).push(cc)
    return acc
  }, {})

  // When named products exist, always keep "(no product)" as a permanent unassign bin.
  // During drag, also surface any named products that currently have no chemicals.
  if (products.length > 0) grouped["(no product)"] ??= []
  if (dragId) products.forEach((name) => { grouped[name] ??= [] })

  // Named groups in natural order, "(no product)" pinned last.
  const unassigned = grouped["(no product)"] ?? []
  const groupEntries: [string, ConsultationChemical[]][] = products.length > 0
    ? [
        ...Object.entries(grouped).filter(([k]) => k !== "(no product)"),
        ["(no product)", unassigned],
      ]
    : Object.entries(grouped)

  const backUrl = encodeURIComponent(`/regulatory/consultations/${consultationId}`)

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-end">
        <form onSubmit={handleAdd} className="flex gap-2 items-end">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              CAS number or chemical name
            </label>
            <Input
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="e.g. 67-64-1 or Acetone"
              disabled={adding}
              className="w-64"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Role (optional)</label>
            <Input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. active"
              disabled={adding}
              className="w-32"
            />
          </div>
          {products.length > 0 && (
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Product (optional)</label>
              <select
                value={productName}
                onChange={(e) => { setProductName(e.target.value); setConcentration("") }}
                disabled={adding}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm w-44"
              >
                <option value="">(no product)</option>
                {products.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          )}
          {productName && (
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Conc % (optional)</label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={concentration}
                onChange={(e) => setConcentration(e.target.value)}
                placeholder="e.g. 5"
                disabled={adding}
                className="w-24"
              />
            </div>
          )}
          <Button type="submit" disabled={adding || !identifier.trim()} size="sm">
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add
          </Button>
        </form>

        <UploadFormulationDialog
          consultationId={consultationId}
          onCommitDone={refreshList}
        />
      </div>

      {/* Chemicals table */}
      {chemicals.length === 0 ? (
        <p className="text-muted-foreground text-sm">No chemicals added yet.</p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          {dragId && (
            <p className="text-xs text-blue-600 bg-blue-50/60 px-4 py-1.5 border-b">
              Drag to a product section to reassign
            </p>
          )}
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Chemical</th>
                <th className="text-left px-4 py-3 font-medium">CAS Number</th>
                <th className="text-left px-4 py-3 font-medium">Conc %</th>
                <th className="text-left px-4 py-3 font-medium">Function</th>
                <th className="text-left px-4 py-3 font-medium">Regulatory Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {groupEntries.map(([groupKey, rows]) => (
                <Fragment key={groupKey}>
                  {/* Product section header — drop target */}
                  <tr
                    className={`border-t transition-colors ${
                      dragOver === groupKey
                        ? "bg-blue-100/70 outline-dashed outline-2 outline-blue-400"
                        : "bg-muted/40"
                    }`}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(groupKey) }}
                    onDrop={(e) => { e.preventDefault(); handleDrop(groupKey) }}
                  >
                    <td colSpan={6} className="px-4 py-2 font-medium text-xs uppercase tracking-wide">
                      {dragOver === groupKey ? (
                        <span className="text-blue-600 font-semibold">↓ Move here</span>
                      ) : (
                        <span className="text-muted-foreground">{groupKey}</span>
                      )}
                    </td>
                  </tr>

                  {/* Empty group — always show a row so the section has visible height */}
                  {rows.length === 0 && (
                    <tr
                      className={dragId ? "bg-blue-50/20" : ""}
                      onDragOver={dragId ? (e) => { e.preventDefault(); setDragOver(groupKey) } : undefined}
                      onDrop={dragId ? (e) => { e.preventDefault(); handleDrop(groupKey) } : undefined}
                    >
                      <td colSpan={6} className="px-4 py-3 text-xs text-muted-foreground italic">
                        {dragId ? "Drop here to assign" : "None"}
                      </td>
                    </tr>
                  )}

                  {rows.map((cc) => {
                    const chem = cc.chemicals
                    const isUnresolved = !chem || cc.chemical_id === null
                    const isResolving  = resolvingId === cc.id
                    const isDragging   = dragId === cc.id

                    if (isUnresolved) {
                      return (
                        <Fragment key={cc.id}>
                          <tr
                            draggable
                            onDragStart={(e) => handleDragStart(e, cc)}
                            onDragEnd={handleDragEnd}
                            onDragOver={(e) => { e.preventDefault(); setDragOver(groupKey) }}
                            onDrop={(e) => { e.preventDefault(); handleDrop(groupKey) }}
                            className={`transition-colors bg-amber-50/20 ${isDragging ? "opacity-40" : "hover:bg-muted/30 cursor-grab active:cursor-grabbing"}`}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <GripVertical className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />
                                <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                <span className="italic text-muted-foreground">
                                  {cc.notes ?? "Unresolved ingredient"}
                                </span>
                                <Badge variant="outline" className="text-xs text-amber-700 border-amber-300 bg-amber-50">
                                  Needs Review
                                </Badge>
                              </div>
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                              {cc.alt_cas ?? "—"}
                            </td>
                            <td className="px-4 py-3 tabular-nums text-xs">
                              {cc.quantity !== null ? `${cc.quantity}%` : "—"}
                            </td>
                            <td className="px-4 py-3">
                              {cc.role ? (
                                <Badge variant="outline" className="text-xs">{cc.role}</Badge>
                              ) : "—"}
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs text-muted-foreground">Not in database</span>
                            </td>
                            <td className="px-4 py-3 text-right flex items-center justify-end gap-1">
                              <PushToDbDialog
                                consultationId={consultationId}
                                consultationChemicalId={cc.id}
                                initialName={cc.notes ?? ""}
                                initialCas={cc.alt_cas ?? ""}
                                frameworks={frameworks}
                                onSuccess={refreshList}
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-amber-600 hover:text-amber-800"
                                title="Link to a known chemical"
                                onClick={() => isResolving ? setResolvingId(null) : startResolve(cc.id)}
                              >
                                {isResolving ? <X className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={() => handleRemove(cc)}
                                disabled={removing === cc.id}
                              >
                                {removing === cc.id
                                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  : <Trash2 className="h-3.5 w-3.5" />
                                }
                              </Button>
                            </td>
                          </tr>

                          {isResolving && (
                            <tr className="bg-amber-50/30">
                              <td colSpan={6} className="px-4 pb-3 pt-1">
                                <div className="flex gap-2 items-center">
                                  <div className="relative flex-1 max-w-sm">
                                    <Input
                                      autoFocus
                                      value={resolveQuery}
                                      onChange={(e) => setResolveQuery(e.target.value)}
                                      placeholder="Search by name or CAS…"
                                      className="h-8 text-xs"
                                    />
                                    {resolveSearching && (
                                      <Loader2 className="absolute right-2 top-2 h-4 w-4 animate-spin text-muted-foreground" />
                                    )}
                                  </div>
                                  <span className="text-xs text-muted-foreground">
                                    Link &ldquo;{cc.notes ?? cc.alt_cas ?? "?"}&rdquo; to a database entry
                                  </span>
                                </div>
                                {resolveResults.length > 0 && (
                                  <div className="mt-2 border rounded-md divide-y max-w-sm shadow-sm bg-background">
                                    {resolveResults.slice(0, 6).map((r) => (
                                      <button
                                        key={r.id}
                                        onClick={() => handleResolveApply(cc.id, r.id)}
                                        disabled={resolveApplying}
                                        className="w-full text-left px-3 py-2 hover:bg-muted/50 text-xs disabled:opacity-50"
                                      >
                                        <span className="font-medium">{r.common_name}</span>
                                        {r.cas_number && (
                                          <span className="text-muted-foreground font-mono ml-2">{r.cas_number}</span>
                                        )}
                                        {r.needs_review && (
                                          <span className="text-amber-600 ml-2">· needs review</span>
                                        )}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    }

                    // ── Resolved row ──────────────────────────────────────────
                    const action = needsAction(chem)
                    return (
                      <Fragment key={cc.id}>
                        <tr
                          draggable
                          onDragStart={(e) => handleDragStart(e, cc)}
                          onDragEnd={handleDragEnd}
                          onDragOver={(e) => { e.preventDefault(); setDragOver(groupKey) }}
                          onDrop={(e) => { e.preventDefault(); handleDrop(groupKey) }}
                          className={`transition-colors ${action ? "bg-red-50/20" : ""} ${isDragging ? "opacity-40" : "hover:bg-muted/30 cursor-grab active:cursor-grabbing"}`}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-start gap-2">
                              <GripVertical className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0 mt-0.5" />
                              <div className="min-w-0">
                                <Link
                                  href={`/regulatory/chemicals/${chem.id}?from=${backUrl}`}
                                  className="font-medium hover:underline"
                                >
                                  {chem.common_name}
                                </Link>
                                {chem.iupac_name && chem.iupac_name !== chem.common_name && (
                                  <div className="text-xs text-muted-foreground truncate max-w-xs">
                                    {chem.iupac_name}
                                  </div>
                                )}
                                <div className="flex gap-1 mt-0.5 flex-wrap">
                                  {chem.needs_review && (
                                    <span className="flex items-center gap-1 text-xs text-amber-600">
                                      <AlertCircle className="h-3 w-3" />
                                      Needs review
                                    </span>
                                  )}
                                  {!chem.needs_review && action && (
                                    <span className="flex items-center gap-1 text-xs text-red-700">
                                      <AlertCircle className="h-3 w-3" />
                                      Requires action
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs">
                            <div>{chem.cas_number ?? "—"}</div>
                            {cc.alt_cas && cc.alt_cas !== chem.cas_number && (
                              <div className="text-muted-foreground">Alt: {cc.alt_cas}</div>
                            )}
                          </td>
                          <td className="px-4 py-3 tabular-nums text-xs">
                            {cc.quantity !== null ? `${cc.quantity}%` : "—"}
                          </td>
                          <td className="px-4 py-3">
                            {cc.role ? (
                              <Badge variant="outline" className="text-xs">{cc.role}</Badge>
                            ) : "—"}
                          </td>
                          <td className="px-4 py-3">
                            {(chem.regulatory_listings ?? []).length === 0 ? (
                              <span className="text-xs text-muted-foreground">—</span>
                            ) : (
                              <div className="flex gap-1 flex-wrap">
                                {frameworks.map((fw) => {
                                  const listing = chem.regulatory_listings.find(
                                    (rl) => rl.framework === fw
                                  )
                                  if (!listing) return null
                                  return (
                                    <RegulatoryStatusBadge
                                      key={fw}
                                      framework={fw}
                                      status={listing.status as RegulatoryStatus}
                                    />
                                  )
                                })}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => handleRemove(cc)}
                              disabled={removing === cc.id}
                            >
                              {removing === cc.id
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <Trash2 className="h-3.5 w-3.5" />
                              }
                            </Button>
                          </td>
                        </tr>
                      </Fragment>
                    )
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
