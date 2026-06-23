"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  ArrowLeft, ArrowRight, Check, Upload, Loader2, AlertCircle, History, X,
} from "lucide-react"
import { toast } from "sonner"
import type { FormulationEntry } from "@/lib/import/formulation-parser"
import type { FormulationPreview, FormulationPreviewRow } from "@/lib/import/formulation-pipeline"

const FRAMEWORKS = [
  { value: "aicis", label: "AICIS" },
  { value: "reach", label: "REACH" },
  { value: "tsca",  label: "TSCA" },
] as const

interface Company { id: string; name: string; country: string | null }

interface Props {
  companies: Company[]
  initialCompanyId: string | null
}

type Step = 1 | 2

export function NewConsultationWizard({ companies, initialCompanyId }: Props) {
  const router = useRouter()

  // ── Step 1 state ──────────────────────────────────────────────────────────
  const [step, setStep]           = useState<Step>(1)
  const [companyId, setCompanyId] = useState(initialCompanyId ?? "")
  const [title, setTitle]         = useState("")
  const [refNum, setRefNum]       = useState("")
  const [frameworks, setFrameworks] = useState<string[]>(["aicis"])
  const [dueDate, setDueDate]     = useState("")

  // ── Step 2 state ──────────────────────────────────────────────────────────
  const fileInputRef                                  = useRef<HTMLInputElement>(null)
  const [uploadProgress, setUploadProgress]           = useState<number | null>(null)
  const [previewProgress, setPreviewProgress]         = useState<{ done: number; total: number } | null>(null)
  const [entries, setEntries]                         = useState<FormulationEntry[] | null>(null)
  const [preview, setPreview]                         = useState<FormulationPreview | null>(null)
  const [selectedRows, setSelectedRows]               = useState<Set<number>>(new Set())
  const [previewError, setPreviewError]               = useState<string | null>(null)

  // ── Submit state ──────────────────────────────────────────────────────────
  const [submitting, setSubmitting]                   = useState(false)
  const [submitPhase, setSubmitPhase]                 = useState<"creating" | "importing" | null>(null)

  // ── Helpers ───────────────────────────────────────────────────────────────
  function toggleFramework(fw: string) {
    setFrameworks((prev) =>
      prev.includes(fw) ? prev.filter((f) => f !== fw) : [...prev, fw]
    )
  }

  const step1Valid = companyId && title.trim() && frameworks.length > 0

  // ── File upload + preview streaming ──────────────────────────────────────
  async function handleFile(file: File) {
    setEntries(null)
    setPreview(null)
    setSelectedRows(new Set())
    setPreviewError(null)
    setUploadProgress(0)

    // Phase 1: parse file via XHR so we get upload progress
    const formData = new FormData()
    formData.append("file", file)

    const entries = await new Promise<FormulationEntry[]>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open("POST", "/api/formulation")
      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) setUploadProgress(Math.round((ev.loaded / ev.total) * 100))
      }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText).entries as FormulationEntry[])
        } else {
          reject(new Error(JSON.parse(xhr.responseText).error ?? "Parse failed"))
        }
      }
      xhr.onerror = () => reject(new Error("Network error"))
      xhr.send(formData)
    }).catch((err: Error) => {
      setPreviewError(err.message)
      setUploadProgress(null)
      return null
    })

    if (!entries) return
    setEntries(entries)
    setUploadProgress(null)

    if (entries.length === 0) {
      setPreviewError("No ingredient rows detected in this file. Check column headers.")
      return
    }

    // Phase 2: stream preview with AICIS status
    setPreviewProgress({ done: 0, total: 5 })

    try {
      const res = await fetch("/api/formulation", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ company_id: companyId, entries }),
      })

      const reader  = res.body!.getReader()
      const decoder = new TextDecoder()
      let buf = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split("\n")
        buf = lines.pop()!
        for (const line of lines) {
          if (!line.trim()) continue
          const msg = JSON.parse(line)
          if (msg.type === "progress") {
            setPreviewProgress({ done: msg.done, total: msg.total })
          } else if (msg.type === "result") {
            const p = msg.preview as FormulationPreview
            setPreview(p)
            setSelectedRows(new Set(p.rows.map((r) => r.rowIndex)))
            setPreviewProgress(null)
          } else if (msg.type === "error") {
            setPreviewError(msg.message)
            setPreviewProgress(null)
          }
        }
      }
    } catch {
      setPreviewError("Failed to generate preview. You can still create the consultation without import.")
      setPreviewProgress(null)
    }
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!step1Valid) return
    setSubmitting(true)
    setSubmitPhase("creating")

    try {
      const createRes = await fetch("/api/consultations", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          company_id:       companyId,
          title:            title.trim(),
          reference_number: refNum.trim() || undefined,
          frameworks,
          due_date:         dueDate || undefined,
        }),
      })

      if (!createRes.ok) {
        const err = await createRes.json()
        toast.error(err.error ?? "Failed to create consultation")
        return
      }

      const created = await createRes.json()
      const consultationId: string = created.id

      // Commit formulation entries if the user uploaded one and selected rows
      if (preview && entries && selectedRows.size > 0) {
        setSubmitPhase("importing")

        const commitRes = await fetch(`/api/consultations/${consultationId}/upload`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            action:      "commit",
            preview,
            entries,
            selectedRows: [...selectedRows],
          }),
        })

        if (commitRes.body) {
          const reader  = commitRes.body.getReader()
          const decoder = new TextDecoder()
          let buf = ""
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buf += decoder.decode(value, { stream: true })
          }
        }
      }

      router.push(`/regulatory/consultations/${consultationId}`)
    } catch {
      toast.error("Network error")
      setSubmitting(false)
      setSubmitPhase(null)
    }
  }

  // ── Match badge ───────────────────────────────────────────────────────────
  function MatchBadge({ row }: { row: FormulationPreviewRow }) {
    if (row.matchedBy === "cas")     return <Badge variant="outline" className="text-xs text-green-700 border-green-300 bg-green-50">CAS</Badge>
    if (row.matchedBy === "alt_cas") return <Badge variant="outline" className="text-xs text-blue-700 border-blue-300 bg-blue-50">Alt CAS</Badge>
    if (row.matchedBy === "name")    return <Badge variant="outline" className="text-xs text-violet-700 border-violet-300 bg-violet-50">Name</Badge>
    return <Badge variant="outline" className="text-xs text-amber-700 border-amber-300 bg-amber-50">New</Badge>
  }

  function AicisCell({ row }: { row: FormulationPreviewRow }) {
    if (!row.aicisStatus) return <span className="text-muted-foreground text-xs">—</span>
    const styles: Record<string, string> = {
      listed:     "text-green-700 border-green-300 bg-green-50",
      restricted: "text-red-700 border-red-300 bg-red-50",
      prohibited: "text-red-900 border-red-400 bg-red-100",
      exempted:   "text-gray-600 border-gray-300",
    }
    return (
      <Badge variant="outline" className={`text-xs ${styles[row.aicisStatus] ?? ""}`}>
        {row.aicisStatus}
      </Badge>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/regulatory/consultations">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">New Consultation</h1>
          <p className="text-sm text-muted-foreground">
            Step {step} of 2 — {step === 1 ? "Details" : "Import Formulation"}
          </p>
        </div>
      </div>

      {/* ── STEP 1: Details ─────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            {/* Company */}
            <div className="col-span-2 space-y-1.5">
              <label className="text-sm font-medium">
                Company <span className="text-destructive">*</span>
              </label>
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">— Select a company —</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.country ? ` (${c.country})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Title */}
            <div className="col-span-2 space-y-1.5">
              <label className="text-sm font-medium">
                Title <span className="text-destructive">*</span>
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Q3 2026 Product Range Review"
                autoFocus
              />
            </div>

            {/* Reference # */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Reference Number</label>
              <Input
                value={refNum}
                onChange={(e) => setRefNum(e.target.value)}
                placeholder="e.g. REF-2026-042"
              />
            </div>

            {/* Due date */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Due Date</label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            {/* Frameworks */}
            <div className="col-span-2 space-y-1.5">
              <label className="text-sm font-medium">
                Regulatory Frameworks <span className="text-destructive">*</span>
              </label>
              <div className="flex gap-4">
                {FRAMEWORKS.map(({ value, label }) => (
                  <label key={value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={frameworks.includes(value)}
                      onChange={() => toggleFramework(value)}
                      className="rounded"
                    />
                    <span className="text-sm">{label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              onClick={() => setStep(2)}
              disabled={!step1Valid}
              variant="outline"
            >
              Next: Import Formulation
              <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!step1Valid || submitting}
            >
              {submitting && submitPhase === "creating" && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Create Consultation
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 2: Import Formulation ───────────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-5">
          {/* Summary of step 1 */}
          <div className="border rounded-lg px-4 py-3 bg-muted/30 text-sm flex flex-wrap gap-x-6 gap-y-1">
            <span><span className="text-muted-foreground">Company:</span> {companies.find((c) => c.id === companyId)?.name}</span>
            <span><span className="text-muted-foreground">Title:</span> {title}</span>
            {refNum && <span><span className="text-muted-foreground">Ref:</span> {refNum}</span>}
            <span><span className="text-muted-foreground">Frameworks:</span> {frameworks.map((f) => f.toUpperCase()).join(", ")}</span>
          </div>

          {/* File drop zone */}
          {!entries && uploadProgress === null && (
            <div
              className="border-2 border-dashed rounded-lg p-10 text-center cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const f = e.dataTransfer.files[0]
                if (f) handleFile(f)
              }}
            >
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm font-medium">Drop client formulation file here</p>
              <p className="text-xs text-muted-foreground mt-1">
                Excel (.xlsx, .xls) — ingredient names, CAS numbers, concentrations
                {" — "}
                <a
                  href="/api/formulation/template"
                  className="underline hover:text-foreground"
                  onClick={(e) => e.stopPropagation()}
                >
                  Download template
                </a>
              </p>
              <Button variant="outline" size="sm" className="mt-3" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}>
                Choose file
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
              />
            </div>
          )}

          {/* Upload progress */}
          {uploadProgress !== null && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Uploading file…</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary transition-all duration-200" style={{ width: `${uploadProgress}%` }} />
              </div>
            </div>
          )}

          {/* Preview progress */}
          {previewProgress && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Analysing ingredients…</span>
                <span>{previewProgress.done}/{previewProgress.total}</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${(previewProgress.done / previewProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Error */}
          {previewError && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              {previewError}
            </div>
          )}

          {/* Preview summary + re-upload */}
          {entries && !previewProgress && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {entries.length.toLocaleString()} rows parsed
                {preview && (
                  <> — {preview.matchedCount} matched, {preview.newCount} new, {preview.needsActionCount} need review</>
                )}
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEntries(null); setPreview(null); setSelectedRows(new Set()); setPreviewError(null)
                  setTimeout(() => fileInputRef.current?.click(), 50)
                }}
              >
                <X className="h-4 w-4 mr-1" /> Replace file
              </Button>
            </div>
          )}

          {/* Preview table */}
          {preview && (
            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 border-b sticky top-0">
                    <tr>
                      <th className="px-2 py-2 w-8">
                        <input
                          type="checkbox"
                          checked={selectedRows.size === preview.rows.length}
                          onChange={(e) => setSelectedRows(e.target.checked ? new Set(preview.rows.map((r) => r.rowIndex)) : new Set())}
                          className="rounded"
                        />
                      </th>
                      <th className="text-left px-3 py-2 font-medium">Ingredient</th>
                      <th className="text-left px-3 py-2 font-medium">CAS</th>
                      <th className="text-left px-3 py-2 font-medium">Conc %</th>
                      <th className="text-left px-3 py-2 font-medium">Product</th>
                      <th className="text-left px-3 py-2 font-medium">Match</th>
                      <th className="text-left px-3 py-2 font-medium">AICIS</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {preview.rows.map((row) => (
                      <tr
                        key={row.rowIndex}
                        className={row.needsAction ? "bg-red-50/20" : ""}
                      >
                        <td className="px-2 py-1.5 text-center">
                          <input
                            type="checkbox"
                            checked={selectedRows.has(row.rowIndex)}
                            onChange={(e) => {
                              const next = new Set(selectedRows)
                              e.target.checked ? next.add(row.rowIndex) : next.delete(row.rowIndex)
                              setSelectedRows(next)
                            }}
                            className="rounded"
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <div className="font-medium">{row.resolvedName ?? row.inciName ?? "—"}</div>
                          {row.resolvedName && row.inciName && row.resolvedName !== row.inciName && (
                            <div className="text-muted-foreground">{row.inciName}</div>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-muted-foreground">
                          <div>{row.resolvedCas ?? row.casNumber ?? "—"}</div>
                          {row.altCas && <div className="text-muted-foreground/70">alt: {row.altCas}</div>}
                        </td>
                        <td className="px-3 py-1.5 text-muted-foreground">
                          {row.concentration !== null ? `${row.concentration}%` : "—"}
                        </td>
                        <td className="px-3 py-1.5 text-muted-foreground">{row.productName ?? "—"}</td>
                        <td className="px-3 py-1.5"><MatchBadge row={row} /></td>
                        <td className="px-3 py-1.5"><AicisCell row={row} /></td>
                        <td className="px-3 py-1.5">
                          {row.previouslyReviewed.length > 0 && (
                            <span className="flex items-center gap-1 text-muted-foreground" title={row.previouslyReviewed.map((p) => p.title).join(", ")}>
                              <History className="h-3.5 w-3.5" />
                              {row.previouslyReviewed.length}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2 border-t bg-muted/30 text-xs text-muted-foreground">
                {selectedRows.size} of {preview.rows.length} ingredients selected
              </div>
            </div>
          )}

          {/* Nav */}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setStep(1)} disabled={submitting}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>

            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {submitPhase === "importing" ? "Importing ingredients…" : "Creating…"}
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-1.5" />
                  {preview && selectedRows.size > 0
                    ? `Create & Import ${selectedRows.size} Ingredient${selectedRows.size !== 1 ? "s" : ""}`
                    : "Create Consultation"}
                </>
              )}
            </Button>

            {!preview && !previewProgress && (
              <Button variant="ghost" onClick={handleSubmit} disabled={submitting}>
                Skip import, create only
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
