"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { RegulatoryStatusBadge } from "@/components/chemicals/RegulatoryStatusBadge"
import { Plus, Trash2, AlertCircle, Loader2 } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import { UploadFormulationDialog } from "./UploadFormulationDialog"
import type { RegulatoryFramework, RegulatoryStatus } from "@/types/database"

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
}

export function ChemicalsTab({ consultationId, frameworks, initialChemicals }: Props) {
  const [chemicals, setChemicals] = useState<ConsultationChemical[]>(initialChemicals)
  const [identifier, setIdentifier] = useState("")
  const [role, setRole]             = useState("")
  const [adding, setAdding]         = useState(false)
  const [removing, setRemoving]     = useState<string | null>(null)

  const refreshList = useCallback(async () => {
    const res = await fetch(`/api/consultations/${consultationId}/chemicals`)
    if (res.ok) setChemicals(await res.json())
  }, [consultationId])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!identifier.trim()) return
    setAdding(true)

    const isCas = /^\d{2,7}-\d{2}-\d$/.test(identifier.trim())
    const body  = isCas
      ? { cas: identifier.trim(), role: role || undefined }
      : { name: identifier.trim(), role: role || undefined }

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
      toast.success("Chemical added")
    } catch {
      toast.error("Network error")
    } finally {
      setAdding(false)
    }
  }

  async function handleRemove(cc: ConsultationChemical) {
    const key = cc.id
    setRemoving(key)
    try {
      const url = cc.chemical_id
        ? `/api/consultations/${consultationId}/chemicals?chemical_id=${cc.chemical_id}`
        : `/api/consultations/${consultationId}/chemicals?id=${cc.id}`
      const res = await fetch(url, { method: "DELETE" })
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

  function needsAction(chem: Chemical): boolean {
    if (chem.needs_review) return true
    return chem.regulatory_listings.some(
      (rl) => rl.framework === "aicis" && rl.status === "restricted"
    )
  }

  const backUrl = encodeURIComponent(`/regulatory/consultations/${consultationId}`)

  return (
    <div className="space-y-6">
      {/* Toolbar: manual add + bulk upload */}
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

      {/* Chemicals list */}
      {chemicals.length === 0 ? (
        <p className="text-muted-foreground text-sm">No chemicals added yet.</p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Chemical</th>
                <th className="text-left px-4 py-3 font-medium">CAS Number</th>
                <th className="text-left px-4 py-3 font-medium">Product</th>
                <th className="text-left px-4 py-3 font-medium">Conc %</th>
                <th className="text-left px-4 py-3 font-medium">Function</th>
                <th className="text-left px-4 py-3 font-medium">Regulatory Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {chemicals.map((cc) => {
                const chem = cc.chemicals
                const isUnresolved = !chem || cc.chemical_id === null

                if (isUnresolved) {
                  return (
                    <tr key={cc.id} className="hover:bg-muted/30 transition-colors bg-amber-50/20">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                          <span className="italic text-muted-foreground">
                            {cc.notes ?? "Unresolved ingredient"}
                          </span>
                          <Badge variant="outline" className="text-xs text-amber-700 border-amber-300 bg-amber-50">
                            Unresolved
                          </Badge>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {cc.alt_cas ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {cc.product_name ?? "—"}
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
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => handleRemove(cc)}
                          disabled={removing === cc.id}
                        >
                          {removing === cc.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </td>
                    </tr>
                  )
                }

                const action = needsAction(chem)
                return (
                  <tr
                    key={cc.id}
                    className={`hover:bg-muted/30 transition-colors ${action ? "bg-red-50/20" : ""}`}
                  >
                    <td className="px-4 py-3">
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
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      <div>{chem.cas_number ?? "—"}</div>
                      {cc.alt_cas && cc.alt_cas !== chem.cas_number && (
                        <div className="text-muted-foreground">Alt: {cc.alt_cas}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {cc.product_name ?? "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-xs">
                      {cc.quantity !== null ? `${cc.quantity}%` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {cc.role ? (
                        <Badge variant="outline" className="text-xs">{cc.role}</Badge>
                      ) : (
                        "—"
                      )}
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
                        {removing === cc.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
