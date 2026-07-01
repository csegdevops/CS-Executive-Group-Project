"use client"

import { useState, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Upload,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  History,
  Plus,
} from "lucide-react"
import { toast } from "sonner"
import type { FormulationPreview, FormulationPreviewRow } from "@/lib/import/formulation-pipeline"
import type { FormulationEntry } from "@/lib/import/formulation-parser"

type Step = "upload" | "preview" | "done"

interface ProgressState {
  label: string
  pct: number
  detail: string
  eta: string | null
}

function fmtBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function fmtEta(s: number) {
  if (s < 5)  return "almost done"
  if (s < 60) return `~${Math.ceil(s)}s remaining`
  return `~${Math.ceil(s / 60)}m remaining`
}

function ProgressBar({ prog }: { prog: ProgressState }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{prog.label}</span>
        <span className="tabular-nums">{prog.pct}%{prog.eta ? ` · ${prog.eta}` : ""}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full transition-all duration-150" style={{ width: `${prog.pct}%` }} />
      </div>
      {prog.detail && <p className="text-xs text-muted-foreground text-right">{prog.detail}</p>}
    </div>
  )
}

function matchBadge(row: FormulationPreviewRow) {
  if (row.isNew) {
    return <Badge variant="outline" className="text-xs text-amber-700 border-amber-300 bg-amber-50">New</Badge>
  }
  if (row.matchedBy === "cas") {
    return <Badge variant="outline" className="text-xs text-green-700 border-green-300 bg-green-50">CAS match</Badge>
  }
  if (row.matchedBy === "alt_cas") {
    return <Badge variant="outline" className="text-xs text-blue-700 border-blue-300 bg-blue-50">Alt CAS</Badge>
  }
  if (row.matchedBy === "pubchem") {
    return <Badge variant="outline" className="text-xs text-cyan-700 border-cyan-300 bg-cyan-50">PubChem</Badge>
  }
  return <Badge variant="outline" className="text-xs text-violet-700 border-violet-300 bg-violet-50">Name match</Badge>
}

interface Props {
  consultationId: string
  onCommitDone: () => void
}

export function UploadFormulationDialog({ consultationId, onCommitDone }: Props) {
  const [open, setOpen]             = useState(false)
  const [step, setStep]             = useState<Step>("upload")
  const [file, setFile]             = useState<File | null>(null)
  const [entries, setEntries]       = useState<FormulationEntry[]>([])
  const [preview, setPreview]       = useState<FormulationPreview | null>(null)
  const [selectedRows, setSelected] = useState<Set<number>>(new Set())
  const [loading, setLoading]       = useState(false)
  const [progress, setProgress]     = useState<ProgressState | null>(null)
  const [result, setResult]         = useState<{ added: number; unresolved: number; skipped: number; errors: string[] } | null>(null)

  const uploadStartRef  = useRef(0)
  const processStartRef = useRef(0)
  const commitStartRef  = useRef(0)

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] ?? null)
  }, [])

  function reset() {
    setStep("upload")
    setFile(null)
    setEntries([])
    setPreview(null)
    setSelected(new Set())
    setResult(null)
    setProgress(null)
  }

  async function handlePreview() {
    if (!file) return
    setLoading(true)

    // Phase 1: XHR upload to parse Excel (byte-level progress)
    let parsedEntries: FormulationEntry[]
    try {
      parsedEntries = await new Promise<FormulationEntry[]>((resolve, reject) => {
        uploadStartRef.current = Date.now()
        setProgress({ label: "Uploading file…", pct: 0, detail: `0 B / ${fmtBytes(file.size)}`, eta: null })

        const fd = new FormData()
        fd.append("action", "parse")
        fd.append("file", file)

        const xhr = new XMLHttpRequest()
        xhr.upload.addEventListener("progress", (e) => {
          if (!e.lengthComputable) return
          const elapsed = (Date.now() - uploadStartRef.current) / 1000
          const rate    = elapsed > 0 ? e.loaded / elapsed : 0
          const rem     = rate > 0 ? (e.total - e.loaded) / rate : null
          setProgress({
            label:  "Uploading file…",
            pct:    Math.round((e.loaded / e.total) * 100),
            detail: `${fmtBytes(e.loaded)} / ${fmtBytes(e.total)}`,
            eta:    rem !== null ? fmtEta(rem) : null,
          })
        })
        xhr.addEventListener("load", () => {
          if (xhr.status >= 400) {
            try { reject(new Error(JSON.parse(xhr.responseText).error ?? "Upload failed")) }
            catch { reject(new Error("Upload failed")) }
            return
          }
          try { resolve(JSON.parse(xhr.responseText).entries) }
          catch { reject(new Error("Failed to parse server response")) }
        })
        xhr.addEventListener("error", () => reject(new Error("Network error")))
        xhr.open("POST", `/api/consultations/${consultationId}/upload`)
        xhr.send(fd)
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed")
      setLoading(false)
      setProgress(null)
      return
    }

    // Phase 2: stream preview (NDJSON)
    processStartRef.current = Date.now()
    setProgress({ label: "Matching ingredients…", pct: 0, detail: `0 / ${parsedEntries.length} entries`, eta: null })

    let pendingResult: { preview: FormulationPreview; entries: FormulationEntry[] } | null = null

    function handleLine(line: string) {
      if (!line.trim()) return
      try {
        const ev = JSON.parse(line) as
          | { type: "progress"; done: number; total: number }
          | { type: "result"; preview: FormulationPreview; entries: FormulationEntry[] }
          | { type: "error"; message: string }

        if (ev.type === "progress") {
          const elapsed = (Date.now() - processStartRef.current) / 1000
          const rate    = elapsed > 0 ? ev.done / elapsed : 0
          const rem     = rate > 0 ? (ev.total - ev.done) / rate : null
          setProgress({
            label:  "Matching ingredients…",
            pct:    Math.round((ev.done / ev.total) * 100),
            detail: `Phase ${ev.done} of ${ev.total}`,
            eta:    rem !== null ? fmtEta(rem) : null,
          })
        } else if (ev.type === "result") {
          pendingResult = { preview: ev.preview, entries: ev.entries }
        } else if (ev.type === "error") {
          toast.error(ev.message)
        }
      } catch { /* ignore partial/malformed lines */ }
    }

    try {
      const res = await fetch(`/api/consultations/${consultationId}/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "preview", entries: parsedEntries }),
      })
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "Preview failed" }))
        toast.error(err.error ?? "Preview failed")
        return
      }

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer    = ""
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop()!
        for (const line of lines) handleLine(line)
      }
      if (buffer.trim()) handleLine(buffer)

      if (pendingResult) {
        const r = pendingResult as { preview: FormulationPreview; entries: FormulationEntry[] }
        setEntries(r.entries)
        setPreview(r.preview)
        setSelected(new Set(r.preview.rows.map((row: FormulationPreviewRow) => row.rowIndex)))
        setStep("preview")
      }
    } catch {
      toast.error("Network error during processing")
    } finally {
      setLoading(false)
      setProgress(null)
    }
  }

  async function handleCommit() {
    if (!preview) return
    setLoading(true)

    commitStartRef.current = Date.now()
    setProgress({ label: "Adding ingredients…", pct: 0, detail: `0 / ${selectedRows.size} rows`, eta: null })

    let pendingResult: { added: number; unresolved: number; skipped: number; errors: string[] } | null = null

    function handleLine(line: string) {
      if (!line.trim()) return
      try {
        const ev = JSON.parse(line) as
          | { type: "progress"; done: number; total: number }
          | { type: "result"; added: number; unresolved: number; skipped: number; errors: string[] }
          | { type: "error"; message: string }

        if (ev.type === "progress") {
          const elapsed = (Date.now() - commitStartRef.current) / 1000
          const rate    = elapsed > 0 ? ev.done / elapsed : 0
          const rem     = rate > 0 ? (ev.total - ev.done) / rate : null
          setProgress({
            label:  "Adding ingredients…",
            pct:    Math.round((ev.done / ev.total) * 100),
            detail: `Phase ${ev.done} of ${ev.total}`,
            eta:    rem !== null ? fmtEta(rem) : null,
          })
        } else if (ev.type === "result") {
          pendingResult = { added: ev.added, unresolved: ev.unresolved, skipped: ev.skipped, errors: ev.errors }
        } else if (ev.type === "error") {
          toast.error(ev.message)
        }
      } catch { /* ignore */ }
    }

    try {
      const res = await fetch(`/api/consultations/${consultationId}/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "commit",
          preview,
          entries,
          selectedRows: [...selectedRows],
        }),
      })
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "Commit failed" }))
        toast.error(err.error ?? "Commit failed")
        return
      }

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let buf       = ""
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split("\n")
        buf = lines.pop()!
        for (const line of lines) handleLine(line)
      }
      if (buf.trim()) handleLine(buf)

      if (pendingResult) {
        const r = pendingResult as { added: number; unresolved: number; skipped: number; errors: string[] }
        setResult(r)
        setStep("done")
        toast.success(`${r.added} ingredient${r.added !== 1 ? "s" : ""} added`)
        onCommitDone()
      }
    } catch {
      toast.error("Network error")
    } finally {
      setLoading(false)
      setProgress(null)
    }
  }

  const allRows     = preview?.rows ?? []
  const allSelected = allRows.length > 0 && allRows.every((r) => selectedRows.has(r.rowIndex))

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(allRows.map((r) => r.rowIndex)) : new Set())
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset() }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="h-4 w-4 mr-2" />
          Upload formulation
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Client Formulation</DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          {(["upload", "preview", "done"] as Step[]).map((s, i) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className={step === s ? "text-foreground font-medium" : ""}>
                {i + 1}. {s.charAt(0).toUpperCase() + s.slice(1)}
              </span>
              {i < 2 && <ChevronRight className="h-3 w-3" />}
            </span>
          ))}
        </div>

        {/* ── Step 1: Upload ── */}
        {step === "upload" && (
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors">
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="hidden"
                id="formulation-file-upload"
              />
              <label htmlFor="formulation-file-upload" className="cursor-pointer text-sm">
                {file ? (
                  <span className="font-medium">{file.name}</span>
                ) : (
                  <span className="text-muted-foreground">Click to select .xlsx, .xls, or .csv</span>
                )}
              </label>
              {!file && (
                <p className="text-xs text-muted-foreground mt-1">
                  Expected columns: INCI Name, CAS Number, Alt CAS (optional), Concentration %, Function, Product Name
                  {" — "}
                  <a href="/api/formulation/template" className="underline hover:text-foreground">
                    Download template
                  </a>
                </p>
              )}
            </div>

            {progress && <ProgressBar prog={progress} />}

            <Button onClick={handlePreview} disabled={!file || loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Generate preview
            </Button>
          </div>
        )}

        {/* ── Step 2: Preview ── */}
        {step === "preview" && preview && (
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                {preview.rows.length} ingredients
              </Badge>
              <Badge className="bg-green-100 text-green-800 border-green-200">
                {preview.matchedCount} matched
              </Badge>
              {preview.newCount > 0 && (
                <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                  <Plus className="h-3 w-3 mr-1" />
                  {preview.newCount} new
                </Badge>
              )}
              {preview.needsActionCount > 0 && (
                <Badge className="bg-red-100 text-red-800 border-red-200">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  {preview.needsActionCount} require action
                </Badge>
              )}
            </div>

            {loading ? (
              <div className="py-6 space-y-4">
                <p className="text-sm font-medium">Adding {selectedRows.size} ingredients…</p>
                {progress && <ProgressBar prog={progress} />}
              </div>
            ) : (
              <>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => setStep("upload")}>Back</Button>
                  <Button size="sm" onClick={handleCommit} disabled={selectedRows.size === 0}>
                    Add {selectedRows.size} ingredient{selectedRows.size !== 1 ? "s" : ""}
                  </Button>
                </div>

                <div className="border rounded-lg overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 border-b">
                      <tr>
                        <th className="px-2 py-2 w-8">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            onChange={(e) => toggleAll(e.target.checked)}
                          />
                        </th>
                        <th className="text-left px-2 py-2">INCI Name</th>
                        <th className="text-left px-2 py-2 whitespace-nowrap">CAS / Alt CAS</th>
                        <th className="text-left px-2 py-2">Conc %</th>
                        <th className="text-left px-2 py-2">Function</th>
                        <th className="text-left px-2 py-2">Product</th>
                        <th className="text-left px-2 py-2">Match</th>
                        <th className="text-left px-2 py-2">AICIS</th>
                        <th className="text-left px-2 py-2">History</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {preview.rows.map((row) => (
                        <tr
                          key={row.rowIndex}
                          className={`hover:bg-muted/20 ${row.needsAction ? "bg-red-50/30" : ""}`}
                        >
                          <td className="px-2 py-2">
                            <input
                              type="checkbox"
                              checked={selectedRows.has(row.rowIndex)}
                              onChange={(e) => {
                                setSelected((prev) => {
                                  const next = new Set(prev)
                                  if (e.target.checked) next.add(row.rowIndex)
                                  else next.delete(row.rowIndex)
                                  return next
                                })
                              }}
                            />
                          </td>
                          <td className="px-2 py-2 max-w-[180px] truncate font-medium" title={row.resolvedName ?? row.inciName ?? undefined}>
                            {row.resolvedName ?? row.inciName ?? "—"}
                          </td>
                          <td className="px-2 py-2 font-mono whitespace-nowrap">
                            <span>{row.resolvedCas ?? "—"}</span>
                            {row.altCas && row.altCas !== row.resolvedCas && (
                              <span className="text-muted-foreground ml-1">/ {row.altCas}</span>
                            )}
                          </td>
                          <td className="px-2 py-2 tabular-nums">
                            {row.concentration !== null ? `${row.concentration}%` : "—"}
                          </td>
                          <td className="px-2 py-2 text-muted-foreground">{row.function ?? "—"}</td>
                          <td className="px-2 py-2 text-muted-foreground">{row.productName ?? "—"}</td>
                          <td className="px-2 py-2">{matchBadge(row)}</td>
                          <td className="px-2 py-2">
                            {row.aicisStatus === "restricted" ? (
                              <span className="flex items-center gap-1 text-red-700 whitespace-nowrap">
                                <AlertCircle className="h-3 w-3" />
                                Restricted
                              </span>
                            ) : row.aicisStatus === "listed" ? (
                              <span className="text-green-700">Listed</span>
                            ) : row.aicisStatus ? (
                              <span className="capitalize text-muted-foreground">{row.aicisStatus}</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-2 py-2">
                            {row.previouslyReviewed.length > 0 ? (
                              <span
                                className="flex items-center gap-1 text-violet-700 whitespace-nowrap cursor-help"
                                title={row.previouslyReviewed.map((r) => r.title).join(", ")}
                              >
                                <History className="h-3 w-3" />
                                {row.previouslyReviewed.length} prior
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => setStep("upload")}>Back</Button>
                  <Button size="sm" onClick={handleCommit} disabled={selectedRows.size === 0}>
                    Add {selectedRows.size} ingredient{selectedRows.size !== 1 ? "s" : ""}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Step 3: Done ── */}
        {step === "done" && result && (
          <div className="py-8 text-center space-y-3">
            <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
            <p className="font-semibold">
              {result.added} ingredient{result.added !== 1 ? "s" : ""} added
              {result.unresolved > 0 && `, ${result.unresolved} unresolved (check Chemicals tab)`}
              {result.skipped > 0 && `, ${result.skipped} skipped`}
            </p>
            {result.errors.length > 0 && (
              <details className="text-left max-w-sm mx-auto">
                <summary className="text-xs text-destructive cursor-pointer">
                  {result.errors.length} error{result.errors.length !== 1 ? "s" : ""}
                </summary>
                <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                  {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </details>
            )}
            <div className="flex gap-2 justify-center">
              <Button size="sm" onClick={reset} variant="outline">Upload another</Button>
              <Button size="sm" onClick={() => setOpen(false)}>Close</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
