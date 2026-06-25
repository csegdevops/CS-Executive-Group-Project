"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Upload, Loader2 } from "lucide-react"
import { toast } from "sonner"
import type { RegulatoryFramework } from "@/types/database"

const FRAMEWORK_LABELS: Record<string, string> = { aicis: "AICIS", reach: "REACH", tsca: "TSCA" }
const STATUS_OPTIONS = [
  { value: "unknown",     label: "Unknown" },
  { value: "not_listed",  label: "Not Listed" },
  { value: "restricted",  label: "Restricted" },
  { value: "exempt",      label: "Exempt" },
  { value: "pending",     label: "Pending" },
]

interface RegulatoryEntry {
  framework: RegulatoryFramework
  status: string
  notes: string
}

const ALL_FRAMEWORKS: RegulatoryFramework[] = ["aicis", "reach", "tsca"]

interface Props {
  consultationId?: string
  consultationChemicalId?: string
  initialName?: string
  initialCas?: string
  frameworks?: RegulatoryFramework[]
  onSuccess?: () => void
  trigger?: React.ReactNode
}

export function PushToDbDialog({
  consultationId,
  consultationChemicalId,
  initialName = "",
  initialCas = "",
  frameworks,
  onSuccess,
  trigger,
}: Props) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [commonName, setCommonName]   = useState(initialName)
  const [casNumber, setCasNumber]     = useState(initialCas)
  const [iupacName, setIupacName]     = useState("")
  const [molFormula, setMolFormula]   = useState("")
  // When no frameworks are pre-selected (standalone mode), allow user to pick
  const [selectedFws, setSelectedFws] = useState<RegulatoryFramework[]>(frameworks ?? [])
  const [regulatory, setRegulatory]   = useState<RegulatoryEntry[]>(
    (frameworks ?? []).map((fw) => ({ framework: fw, status: "unknown", notes: "" }))
  )

  const standaloneMode = !frameworks

  function toggleFw(fw: RegulatoryFramework) {
    setSelectedFws((prev) => {
      const next = prev.includes(fw) ? prev.filter((f) => f !== fw) : [...prev, fw]
      setRegulatory(next.map((f) => regulatory.find((r) => r.framework === f) ?? { framework: f, status: "unknown", notes: "" }))
      return next
    })
  }

  function updateReg(fw: RegulatoryFramework, field: "status" | "notes", value: string) {
    setRegulatory((prev) =>
      prev.map((r) => r.framework === fw ? { ...r, [field]: value } : r)
    )
  }

  async function handleSubmit() {
    if (!commonName.trim()) { toast.error("Common name is required"); return }
    setSaving(true)
    try {
      const res = await fetch("/api/chemicals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          common_name: commonName.trim(),
          cas_number:  casNumber.trim() || null,
          iupac_name:  iupacName.trim() || null,
          molecular_formula: molFormula.trim() || null,
          consultation_chemical_id: consultationChemicalId,
          consultation_id: consultationId,
          regulatory: regulatory.map((r) => ({
            framework: r.framework,
            status: r.status,
            notes: r.notes || null,
          })),
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? "Failed to push chemical")
        return
      }
      toast.success("Chemical pushed to database — pending admin review")
      setOpen(false)
      onSuccess?.()
    } catch {
      toast.error("Network error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="sm" className="h-7 px-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50" title="Push to database as Chemskill chemical">
            <Upload className="h-3.5 w-3.5 mr-1" /> Push to DB
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Push Chemical to Database</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-1">
          Creates a Chemskill chemical pending admin review.
        </p>

        <div className="space-y-4 mt-3">
          {/* Identity */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Identity</h3>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Common Name *</label>
              <Input value={commonName} onChange={(e) => setCommonName(e.target.value)} placeholder="Chemical name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">CAS Number</label>
                <Input value={casNumber} onChange={(e) => setCasNumber(e.target.value)} placeholder="e.g. 67-64-1" className="font-mono text-sm" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Molecular Formula</label>
                <Input value={molFormula} onChange={(e) => setMolFormula(e.target.value)} placeholder="e.g. C3H6O" className="font-mono text-sm" />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">IUPAC / INCI Name</label>
              <Input value={iupacName} onChange={(e) => setIupacName(e.target.value)} placeholder="Optional systematic name" />
            </div>
          </section>

          {/* Framework picker in standalone mode */}
          {standaloneMode && (
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Regulatory Frameworks</h3>
              <div className="flex gap-3">
                {ALL_FRAMEWORKS.map((fw) => (
                  <label key={fw} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input type="checkbox" checked={selectedFws.includes(fw)} onChange={() => toggleFw(fw)} className="rounded" />
                    {FRAMEWORK_LABELS[fw]}
                  </label>
                ))}
              </div>
            </section>
          )}

          {/* Regulatory */}
          {selectedFws.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Regulatory Status</h3>
              {regulatory.map((r) => (
                <div key={r.framework} className="border rounded-md p-3 space-y-2">
                  <p className="text-xs font-medium">{FRAMEWORK_LABELS[r.framework] ?? r.framework.toUpperCase()}</p>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Status</label>
                    <select
                      value={r.status}
                      onChange={(e) => updateReg(r.framework, "status", e.target.value)}
                      className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Notes / Limitations</label>
                    <textarea
                      value={r.notes}
                      onChange={(e) => updateReg(r.framework, "notes", e.target.value)}
                      placeholder="Conditions, restrictions, or limitations…"
                      rows={2}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                    />
                  </div>
                </div>
              ))}
            </section>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button size="sm" onClick={handleSubmit} disabled={saving || !commonName.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Upload className="h-4 w-4 mr-1.5" />}
              Push to Database
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
