"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { RegulatoryStatusBadge } from "@/components/chemicals/RegulatoryStatusBadge"
import { Plus, Trash2, AlertCircle, Loader2 } from "lucide-react"
import { toast } from "sonner"
import type { RegulatoryFramework, RegulatoryStatus } from "@/types/database"

interface Chemical {
  id: string
  cas_number: string | null
  common_name: string
  iupac_name: string | null
  molecular_formula: string | null
  needs_review: boolean
  regulatory_listings: { id: string; framework: string; status: string }[]
}

interface ConsultationChemical {
  id: string
  role: string | null
  quantity: number | null
  unit: string | null
  notes: string | null
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
  const [role, setRole] = useState("")
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!identifier.trim()) return
    setAdding(true)

    const isCas = /^\d{2,7}-\d{2}-\d$/.test(identifier.trim())
    const body = isCas
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

      // Refetch the full list to get resolved chemical data
      const listRes = await fetch(`/api/consultations/${consultationId}/chemicals`)
      if (listRes.ok) {
        const updated = await listRes.json()
        setChemicals(updated)
      }

      setIdentifier("")
      setRole("")
      toast.success("Chemical added")
    } catch {
      toast.error("Network error")
    } finally {
      setAdding(false)
    }
  }

  async function handleRemove(chemicalId: string) {
    setRemoving(chemicalId)
    try {
      const res = await fetch(
        `/api/consultations/${consultationId}/chemicals?chemical_id=${chemicalId}`,
        { method: "DELETE" }
      )
      if (res.ok) {
        setChemicals((prev) => prev.filter((cc) => cc.chemicals?.id !== chemicalId))
        toast.success("Removed")
      } else {
        toast.error("Failed to remove chemical")
      }
    } catch {
      toast.error("Network error")
    } finally {
      setRemoving(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Add chemical form */}
      <form onSubmit={handleAdd} className="flex gap-2 items-end max-w-xl">
        <div className="flex-1">
          <label className="text-xs text-muted-foreground mb-1 block">
            CAS number or chemical name
          </label>
          <Input
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="e.g. 67-64-1 or Acetone"
            disabled={adding}
          />
        </div>
        <div className="w-40">
          <label className="text-xs text-muted-foreground mb-1 block">Role (optional)</label>
          <Input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="e.g. active"
            disabled={adding}
          />
        </div>
        <Button type="submit" disabled={adding || !identifier.trim()} className="shrink-0">
          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add
        </Button>
      </form>

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
                <th className="text-left px-4 py-3 font-medium">Role</th>
                <th className="text-left px-4 py-3 font-medium">Regulatory Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {chemicals.map((cc) => {
                const chem = cc.chemicals
                if (!chem) return null
                return (
                  <tr key={cc.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium">{chem.common_name}</div>
                      {chem.iupac_name && chem.iupac_name !== chem.common_name && (
                        <div className="text-xs text-muted-foreground truncate max-w-xs">{chem.iupac_name}</div>
                      )}
                      {chem.needs_review && (
                        <div className="flex items-center gap-1 text-xs text-amber-600 mt-0.5">
                          <AlertCircle className="h-3 w-3" />
                          Needs review
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{chem.cas_number ?? "—"}</td>
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
                        onClick={() => handleRemove(chem.id)}
                        disabled={removing === chem.id}
                      >
                        {removing === chem.id ? (
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
