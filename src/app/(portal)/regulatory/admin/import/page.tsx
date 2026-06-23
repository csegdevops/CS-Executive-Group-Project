"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/layout/PageHeader"
import { CheckCircle2, XCircle, AlertCircle, Loader2, Upload, ChevronRight } from "lucide-react"
import { toast } from "sonner"
import type { ImportPreview, ImportPreviewRow } from "@/lib/import/import-pipeline"
import type { ColumnMapping } from "@/lib/import/column-mapper"

type Step = "upload" | "map" | "preview" | "done"

export default function ImportPage() {
  const [step, setStep] = useState<Step>("upload")
  const [file, setFile] = useState<File | null>(null)
  const [consultationId, setConsultationId] = useState("")
  const [headers, setHeaders] = useState<string[]>([])
  const [mapping, setMapping] = useState<ColumnMapping>({
    casColumn: null, nameColumn: null, quantityColumn: null,
    unitColumn: null, notesColumn: null, roleColumn: null,
  })
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ added: number; skipped: number } | null>(null)

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] ?? null)
  }, [])

  async function handlePreview() {
    if (!file || !consultationId) return
    setLoading(true)

    const fd = new FormData()
    fd.append("action", "preview")
    fd.append("file", file)
    fd.append("consultation_id", consultationId)

    try {
      const res = await fetch("/api/import", { method: "POST", body: fd })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? "Import failed")
        return
      }
      const data = await res.json()
      setHeaders(data.headers)
      setMapping(data.mapping)
      setPreview(data.preview)
      setSelectedRows(
        new Set(
          (data.preview.rows as ImportPreviewRow[])
            .filter((r) => r.resolved)
            .map((r) => r.rowIndex)
        )
      )
      setStep("map")
    } catch {
      toast.error("Network error")
    } finally {
      setLoading(false)
    }
  }

  async function handleRePreview() {
    if (!file || !consultationId) return
    setLoading(true)

    const fd = new FormData()
    fd.append("action", "preview")
    fd.append("file", file)
    fd.append("consultation_id", consultationId)
    fd.append("column_mapping", JSON.stringify(mapping))

    try {
      const res = await fetch("/api/import", { method: "POST", body: fd })
      if (!res.ok) return
      const data = await res.json()
      setPreview(data.preview)
      setSelectedRows(
        new Set(
          (data.preview.rows as ImportPreviewRow[])
            .filter((r) => r.resolved)
            .map((r) => r.rowIndex)
        )
      )
      setStep("preview")
    } catch {
      toast.error("Network error")
    } finally {
      setLoading(false)
    }
  }

  async function handleCommit() {
    if (!preview) return
    setLoading(true)

    const fd = new FormData()
    fd.append("action", "commit")
    fd.append("consultation_id", consultationId)
    fd.append("preview", JSON.stringify(preview))
    fd.append("selected_rows", JSON.stringify([...selectedRows]))

    try {
      const res = await fetch("/api/import", { method: "POST", body: fd })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? "Commit failed")
        return
      }
      const data = await res.json()
      setResult(data)
      setStep("done")
      toast.success(`Import complete: ${data.added} chemicals added`)
    } catch {
      toast.error("Network error")
    } finally {
      setLoading(false)
    }
  }

  const mappingFields: { key: keyof ColumnMapping; label: string }[] = [
    { key: "casColumn", label: "CAS Number column" },
    { key: "nameColumn", label: "Chemical Name column" },
    { key: "quantityColumn", label: "Quantity column" },
    { key: "unitColumn", label: "Unit column" },
    { key: "roleColumn", label: "Role column" },
    { key: "notesColumn", label: "Notes column" },
  ]

  return (
    <div className="max-w-3xl">
      <PageHeader title="Import from Excel" description="Upload your existing spreadsheet to populate a consultation" />

      {/* Step indicators */}
      <div className="flex items-center gap-2 mb-8 text-sm">
        {(["upload", "map", "preview", "done"] as Step[]).map((s, i) => (
          <span key={s} className="flex items-center gap-2">
            <span className={step === s ? "font-semibold text-foreground" : "text-muted-foreground capitalize"}>
              {i + 1}. {s.charAt(0).toUpperCase() + s.slice(1)}
            </span>
            {i < 3 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
          </span>
        ))}
      </div>

      {/* ── Step 1: Upload ─────────────────────────────────────────────── */}
      {step === "upload" && (
        <Card>
          <CardHeader><CardTitle>Upload spreadsheet</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Excel file (.xlsx)</Label>
              <div className="mt-1 border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer text-sm">
                  {file ? (
                    <span className="font-medium text-foreground">{file.name}</span>
                  ) : (
                    <span className="text-muted-foreground">Click to select or drag and drop</span>
                  )}
                </label>
              </div>
            </div>
            <div>
              <Label htmlFor="consultation-id">Target Consultation ID</Label>
              <Input
                id="consultation-id"
                value={consultationId}
                onChange={(e) => setConsultationId(e.target.value)}
                placeholder="Paste the consultation UUID"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Find this in the URL when viewing a consultation.
              </p>
            </div>
            <Button
              onClick={handlePreview}
              disabled={!file || !consultationId || loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Continue
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Step 2: Map Columns ────────────────────────────────────────── */}
      {step === "map" && (
        <Card>
          <CardHeader>
            <CardTitle>Map columns</CardTitle>
            <p className="text-sm text-muted-foreground">
              We auto-detected the following mappings. Adjust if needed.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {mappingFields.map(({ key, label }) => (
              <div key={key} className="flex items-center gap-4">
                <Label className="w-40 shrink-0 text-sm">{label}</Label>
                <select
                  className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={mapping[key] ?? ""}
                  onChange={(e) =>
                    setMapping((m) => ({ ...m, [key]: e.target.value || null }))
                  }
                >
                  <option value="">(not mapped)</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <Button onClick={handleRePreview} disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Generate Preview
              </Button>
              <Button variant="outline" onClick={() => setStep("upload")}>Back</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Step 3: Preview ────────────────────────────────────────────── */}
      {step === "preview" && preview && (
        <div className="space-y-4">
          <div className="flex gap-4">
            <Badge className="bg-green-100 text-green-800 border-green-200">
              ✓ {preview.resolvedCount} resolved
            </Badge>
            <Badge className="bg-amber-100 text-amber-800 border-amber-200">
              ⚠ {preview.needsReviewCount} need review
            </Badge>
            <Badge variant="destructive">
              ✗ {preview.unresolvedCount} failed
            </Badge>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="px-3 py-2 w-8">
                    <input
                      type="checkbox"
                      checked={preview.rows.filter((r) => r.resolved).every((r) => selectedRows.has(r.rowIndex))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedRows(new Set(preview.rows.filter((r) => r.resolved).map((r) => r.rowIndex)))
                        } else {
                          setSelectedRows(new Set())
                        }
                      }}
                    />
                  </th>
                  <th className="text-left px-3 py-2">Input</th>
                  <th className="text-left px-3 py-2">Resolved As</th>
                  <th className="text-left px-3 py-2">CAS</th>
                  <th className="text-left px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {preview.rows.map((row) => (
                  <tr key={row.rowIndex} className="hover:bg-muted/20">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedRows.has(row.rowIndex)}
                        disabled={!row.resolved}
                        onChange={(e) => {
                          setSelectedRows((prev) => {
                            const next = new Set(prev)
                            if (e.target.checked) next.add(row.rowIndex)
                            else next.delete(row.rowIndex)
                            return next
                          })
                        }}
                      />
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {row.cas && <div className="font-mono">{row.cas}</div>}
                      {row.name && <div>{row.name}</div>}
                    </td>
                    <td className="px-3 py-2">{row.chemicalName ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs">{row.resolvedCas ?? "—"}</td>
                    <td className="px-3 py-2">
                      {row.resolved && !row.needsReview && (
                        <span className="flex items-center gap-1 text-green-700 text-xs">
                          <CheckCircle2 className="h-3 w-3" /> Resolved
                        </span>
                      )}
                      {row.resolved && row.needsReview && (
                        <span className="flex items-center gap-1 text-amber-700 text-xs">
                          <AlertCircle className="h-3 w-3" /> Needs review
                        </span>
                      )}
                      {!row.resolved && (
                        <span className="flex items-center gap-1 text-red-700 text-xs">
                          <XCircle className="h-3 w-3" /> {row.error ?? "Failed"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleCommit}
              disabled={selectedRows.size === 0 || loading}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Import {selectedRows.size} chemicals
            </Button>
            <Button variant="outline" onClick={() => setStep("map")}>Back</Button>
          </div>
        </div>
      )}

      {/* ── Step 4: Done ───────────────────────────────────────────────── */}
      {step === "done" && result && (
        <Card>
          <CardContent className="py-10 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Import complete</h2>
            <p className="text-muted-foreground">
              {result.added} chemical{result.added !== 1 ? "s" : ""} added to the consultation.
              {result.skipped > 0 && ` ${result.skipped} skipped (already present).`}
            </p>
            <Button
              className="mt-6"
              onClick={() => {
                setStep("upload")
                setFile(null)
                setConsultationId("")
                setPreview(null)
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
