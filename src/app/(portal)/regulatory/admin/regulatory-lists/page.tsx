"use client"

import { useState, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/layout/PageHeader"
import {
  CheckCircle2,
  Loader2,
  Upload,
  ChevronRight,
  AlertCircle,
  Plus,
} from "lucide-react"
import { toast } from "sonner"
import type { RegulatoryListPreview, RegulatoryListPreviewRow } from "@/lib/import/regulatory-list-pipeline"
import type { AicisEntry } from "@/lib/import/aicis-parser"

type Step = "upload" | "preview" | "done"
type Source = "aicis"

const SOURCE_LABELS: Record<Source, string> = {
  aicis: "AICIS Inventory (Australian)",
}

interface ProgressState {
  label: string
  pct: number
  detail: string   // e.g. "143 / 800 rows" or "4.2 MB / 12 MB"
  eta: string | null
}

function fmtEta(seconds: number): string {
  if (seconds < 5)  return "almost done"
  if (seconds < 60) return `~${Math.ceil(seconds)}s remaining`
  return `~${Math.ceil(seconds / 60)}m remaining`
}

function fmtBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function ProgressBar({ prog }: { prog: ProgressState }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{prog.label}</span>
        <span className="tabular-nums">
          {prog.pct}%{prog.eta ? ` · ${prog.eta}` : ""}
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-150"
          style={{ width: `${prog.pct}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground text-right">{prog.detail}</p>
    </div>
  )
}

export default function RegulatoryListsPage() {
  const [step, setStep]         = useState<Step>("upload")
  const [source, setSource]     = useState<Source>("aicis")
  const [file, setFile]         = useState<File | null>(null)
  const [preview, setPreview]   = useState<RegulatoryListPreview | null>(null)
  const [entries, setEntries]   = useState<AicisEntry[]>([])
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())
  const [loading, setLoading]   = useState(false)
  const [progress, setProgress] = useState<ProgressState | null>(null)
  const [committing, setCommitting] = useState(false)
  const [result, setResult]     = useState<{ upserted: number; skipped: number; errors: string[] } | null>(null)

  // Timing refs — don't need to trigger re-renders
  const uploadStartRef  = useRef(0)
  const processStartRef = useRef(0)
  const commitStartRef  = useRef(0)

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] ?? null)
  }, [])

  async function handlePreview() {
    if (!file) return
    setLoading(true)

    // ── Phase 1: upload file via XHR to get byte-level progress ─────────────
    let parsedEntries: AicisEntry[]
    try {
      parsedEntries = await new Promise<AicisEntry[]>((resolve, reject) => {
        uploadStartRef.current = Date.now()
        setProgress({ label: "Uploading file…", pct: 0, detail: `0 B / ${fmtBytes(file.size)}`, eta: null })

        const fd = new FormData()
        fd.append("action", "parse")
        fd.append("source", source)
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
        xhr.open("POST", "/api/admin/regulatory-lists")
        xhr.send(fd)
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed")
      setLoading(false)
      setProgress(null)
      return
    }

    // ── Phase 2: stream preview via fetch + ReadableStream (reliable NDJSON) ─
    processStartRef.current = Date.now()
    setProgress({
      label:  "Resolving chemicals…",
      pct:    0,
      detail: `0 / ${parsedEntries.length} rows`,
      eta:    null,
    })

    let pendingResult: { preview: RegulatoryListPreview; entries: AicisEntry[] } | null = null

    function handleLine(line: string) {
      if (!line.trim()) return
      try {
        const ev = JSON.parse(line) as
          | { type: "progress"; done: number; total: number }
          | { type: "result"; preview: RegulatoryListPreview; entries: AicisEntry[] }
          | { type: "error"; message: string }

        if (ev.type === "progress") {
          const elapsed = (Date.now() - processStartRef.current) / 1000
          const rate    = elapsed > 0 ? ev.done / elapsed : 0
          const rem     = rate > 0 ? (ev.total - ev.done) / rate : null
          setProgress({
            label:  "Resolving chemicals…",
            pct:    Math.round((ev.done / ev.total) * 100),
            detail: `${ev.done} / ${ev.total} rows`,
            eta:    rem !== null ? fmtEta(rem) : null,
          })
        } else if (ev.type === "result") {
          pendingResult = { preview: ev.preview, entries: ev.entries }
        } else if (ev.type === "error") {
          toast.error(ev.message)
        }
      } catch { /* ignore malformed / partial lines */ }
    }

    try {
      const res = await fetch("/api/admin/regulatory-lists", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action: "preview", source, entries: parsedEntries }),
      })

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "Preview failed" }))
        toast.error(err.error ?? "Preview failed")
        return
      }

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let lineBuffer = ""

      // ReadableStream.getReader() yields on each await, giving React time to render
      // between chunks — this makes the progress bar visibly animate.
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        lineBuffer += decoder.decode(value, { stream: true })
        const lines = lineBuffer.split("\n")
        lineBuffer  = lines.pop()!   // keep incomplete trailing segment
        for (const line of lines) handleLine(line)
      }
      if (lineBuffer.trim()) handleLine(lineBuffer)

      if (pendingResult) {
        // TypeScript loses the non-null narrowing through closures; re-assert here
        const result = pendingResult as { preview: RegulatoryListPreview; entries: AicisEntry[] }
        setEntries(result.entries)
        setPreview(result.preview)
        setSelectedRows(new Set(result.preview.rows.map((r: RegulatoryListPreviewRow) => r.rowIndex)))
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
    setCommitting(true)

    commitStartRef.current = Date.now()
    const total = selectedRows.size
    setProgress({ label: "Importing listings…", pct: 0, detail: `0 / ${total} rows`, eta: null })

    let pendingResult: { upserted: number; skipped: number; errors: string[] } | null = null

    function handleLine(line: string) {
      if (!line.trim()) return
      try {
        const ev = JSON.parse(line) as
          | { type: "progress"; done: number; total: number }
          | { type: "result"; upserted: number; skipped: number; errors: string[] }
          | { type: "error"; message: string }

        if (ev.type === "progress") {
          const elapsed = (Date.now() - commitStartRef.current) / 1000
          const rate    = elapsed > 0 ? ev.done / elapsed : 0
          const rem     = rate > 0 ? (ev.total - ev.done) / rate : null
          setProgress({
            label:  "Importing listings…",
            pct:    Math.round((ev.done / ev.total) * 100),
            detail: `${ev.done} / ${ev.total} rows`,
            eta:    rem !== null ? fmtEta(rem) : null,
          })
        } else if (ev.type === "result") {
          pendingResult = { upserted: ev.upserted, skipped: ev.skipped, errors: ev.errors }
        } else if (ev.type === "error") {
          toast.error(ev.message)
        }
      } catch { /* ignore malformed lines */ }
    }

    try {
      const res = await fetch("/api/admin/regulatory-lists", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          action:       "commit",
          source,
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
      let lineBuffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        lineBuffer += decoder.decode(value, { stream: true })
        const lines = lineBuffer.split("\n")
        lineBuffer  = lines.pop()!
        for (const line of lines) handleLine(line)
      }
      if (lineBuffer.trim()) handleLine(lineBuffer)

      if (pendingResult) {
        const r = pendingResult as { upserted: number; skipped: number; errors: string[] }
        setResult(r)
        setStep("done")
        toast.success(`Done: ${r.upserted} listings updated`)
      }
    } catch {
      toast.error("Network error")
    } finally {
      setLoading(false)
      setCommitting(false)
      setProgress(null)
    }
  }

  const allRows    = preview?.rows ?? []
  const allSelected = allRows.length > 0 && allRows.every((r) => selectedRows.has(r.rowIndex))

  function toggleAll(checked: boolean) {
    setSelectedRows(checked ? new Set(allRows.map((r) => r.rowIndex)) : new Set())
  }

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Update Regulatory Lists"
        description="Import chemical listings from official regulatory sources to update the master database"
      />

      {/* Step indicators */}
      <div className="flex items-center gap-2 mb-8 text-sm">
        {(["upload", "preview", "done"] as Step[]).map((s, i) => (
          <span key={s} className="flex items-center gap-2">
            <span className={step === s ? "font-semibold text-foreground" : "text-muted-foreground capitalize"}>
              {i + 1}. {s.charAt(0).toUpperCase() + s.slice(1)}
            </span>
            {i < 2 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
          </span>
        ))}
      </div>

      {/* ── Step 1: Upload ─────────────────────────────────────────────── */}
      {step === "upload" && (
        <Card>
          <CardHeader><CardTitle>Upload regulatory list file</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div>
              <label className="text-sm font-medium">Source</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {(Object.keys(SOURCE_LABELS) as Source[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSource(s)}
                    className={`px-3 py-1.5 rounded-md border text-sm transition-colors ${
                      source === s
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input bg-background hover:bg-muted"
                    }`}
                  >
                    {SOURCE_LABELS[s]}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {source === "aicis" &&
                  "Download the AICIS Inventory spreadsheet from the AICIS portal and upload it here."}
              </p>
            </div>

            <div>
              <label className="text-sm font-medium">Excel file (.xlsx / .xls)</label>
              <div className="mt-1 border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                  id="rl-file-upload"
                />
                <label htmlFor="rl-file-upload" className="cursor-pointer text-sm">
                  {file ? (
                    <span className="font-medium text-foreground">{file.name}</span>
                  ) : (
                    <span className="text-muted-foreground">Click to select or drag and drop</span>
                  )}
                </label>
              </div>
            </div>

            {progress && <ProgressBar prog={progress} />}

            <Button onClick={handlePreview} disabled={!file || loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Generate Preview
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Step 2: Preview ────────────────────────────────────────────── */}
      {step === "preview" && preview && (
        <div className="space-y-4">
          {/* Summary badges — always visible */}
          <div className="flex gap-3 flex-wrap">
            <Badge className="bg-blue-100 text-blue-800 border-blue-200">
              {preview.rows.length} total rows
            </Badge>
            <Badge className="bg-green-100 text-green-800 border-green-200">
              {preview.existingCount} existing
            </Badge>
            <Badge className="bg-amber-100 text-amber-800 border-amber-200">
              <Plus className="h-3 w-3 mr-1" />
              {preview.newCount} new chemicals
            </Badge>
          </div>

          {committing ? (
            /* ── Collapsed import-progress view ── */
            <Card>
              <CardContent className="py-6 space-y-4">
                <p className="text-sm font-medium">Importing {selectedRows.size} listings…</p>
                {progress && <ProgressBar prog={progress} />}
              </CardContent>
            </Card>
          ) : (
            /* ── Full preview table ── */
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div /> {/* spacer — badges already above */}
                <div className="flex gap-2">
                  <Button onClick={handleCommit} disabled={selectedRows.size === 0 || loading}>
                    Import {selectedRows.size} listings
                  </Button>
                  <Button variant="outline" onClick={() => setStep("upload")}>Back</Button>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="px-3 py-2 w-8">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={(e) => toggleAll(e.target.checked)}
                        />
                      </th>
                      <th className="text-left px-3 py-2 text-xs">In DB</th>
                      <th className="text-left px-3 py-2 text-xs">CR No.</th>
                      <th className="text-left px-3 py-2 text-xs">CAS No.</th>
                      <th className="text-left px-3 py-2 text-xs">Chemical Name</th>
                      <th className="text-left px-3 py-2 text-xs">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {preview.rows.map((row) => (
                      <tr key={row.rowIndex} className="hover:bg-muted/20">
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selectedRows.has(row.rowIndex)}
                            onChange={(e) =>
                              setSelectedRows((prev) => {
                                const next = new Set(prev)
                                if (e.target.checked) next.add(row.rowIndex)
                                else next.delete(row.rowIndex)
                                return next
                              })
                            }
                          />
                        </td>
                        <td className="px-3 py-2">
                          {row.isNew ? (
                            <Badge variant="outline" className="text-xs text-amber-700 border-amber-300">New</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-green-700 border-green-300">Exists</Badge>
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                          {row.crNumber ?? "—"}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">
                          {row.resolvedCas ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-xs max-w-xs truncate" title={row.resolvedName ?? undefined}>
                          {row.resolvedName ?? "—"}
                        </td>
                        <td className="px-3 py-2">
                          {row.status === "restricted" ? (
                            <span className="flex items-center gap-1 text-amber-700 text-xs">
                              <AlertCircle className="h-3 w-3" /> Restricted
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-green-700 text-xs">
                              <CheckCircle2 className="h-3 w-3" /> Listed
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleCommit} disabled={selectedRows.size === 0 || loading}>
                  Import {selectedRows.size} listings
                </Button>
                <Button variant="outline" onClick={() => setStep("upload")}>Back</Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Step 3: Done ───────────────────────────────────────────────── */}
      {step === "done" && result && (
        <Card>
          <CardContent className="py-10 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Import complete</h2>
            <p className="text-muted-foreground">
              {result.upserted} regulatory listing{result.upserted !== 1 ? "s" : ""} updated.
              {result.skipped > 0 && ` ${result.skipped} skipped.`}
            </p>
            {result.errors.length > 0 && (
              <details className="mt-4 text-left max-w-md mx-auto">
                <summary className="text-xs text-destructive cursor-pointer">
                  {result.errors.length} error{result.errors.length !== 1 ? "s" : ""} — click to expand
                </summary>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </details>
            )}
            <Button
              className="mt-6"
              onClick={() => {
                setStep("upload")
                setFile(null)
                setPreview(null)
                setEntries([])
                setResult(null)
              }}
            >
              Import another file
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
