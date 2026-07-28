"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { FileText, Upload, Trash2, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { CvParseStatusControl } from "./CvParseStatusControl"

interface DocumentEntry {
  id: string
  doc_type: "cv" | "cl"
  application_id: string | null
  original_name: string | null
  created_at: string
  job_title: string | null
}

interface Props {
  candidateId: string
  documents: DocumentEntry[]
  cvParseStatus: string
}

export function CandidateDocumentsSection({ candidateId, documents, cvParseStatus }: Props) {
  const router = useRouter()
  const cvInputRef = useRef<HTMLInputElement>(null)
  const clInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState<"cv" | "cl" | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const cvs = documents.filter((d) => d.doc_type === "cv")
  const cls = documents.filter((d) => d.doc_type === "cl")

  async function handleUpload(docType: "cv" | "cl", file: File) {
    setUploading(docType)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("type", docType)
      const res = await fetch(`/api/recruitment/candidates/${candidateId}/documents`, { method: "POST", body: formData })
      if (!res.ok) { toast.error("Upload failed"); return }
      toast.success(docType === "cv" ? "CV uploaded — parsing in the background" : "Cover letter uploaded")
      router.refresh()
    } catch {
      toast.error("Network error")
    } finally {
      setUploading(null)
      if (docType === "cv" && cvInputRef.current) cvInputRef.current.value = ""
      if (docType === "cl" && clInputRef.current) clInputRef.current.value = ""
    }
  }

  async function handleDelete(documentId: string) {
    setDeletingId(documentId)
    try {
      const res = await fetch(`/api/recruitment/candidates/${candidateId}/documents/${documentId}`, { method: "DELETE" })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error ?? "Delete failed")
        return
      }
      toast.success("Document deleted")
      router.refresh()
    } catch {
      toast.error("Network error")
    } finally {
      setDeletingId(null)
    }
  }

  function DocList({ docs, docType }: { docs: DocumentEntry[]; docType: "cv" | "cl" }) {
    if (docs.length === 0) {
      return <p className="text-xs text-muted-foreground">No {docType === "cv" ? "CV" : "cover letter"} on file.</p>
    }
    return (
      <div className="space-y-1.5">
        {docs.map((d, i) => (
          <div key={d.id} className="flex items-center gap-2 text-sm flex-wrap">
            <a
              href={`/api/recruitment/candidates/${candidateId}/documents/${d.id}`}
              className="flex items-center gap-1.5 text-primary hover:underline min-w-0"
            >
              <FileText className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate max-w-40">{d.original_name ?? (docType === "cv" ? "CV" : "Cover letter")}</span>
            </a>
            {i === 0 && <Badge variant="outline" className="text-xs shrink-0">Current</Badge>}
            <span className="text-xs text-muted-foreground shrink-0">
              {new Date(d.created_at).toLocaleDateString("en-AU")} · {d.job_title ? `via ${d.job_title}` : "Manual upload"}
            </span>
            {i === 0 && docType === "cv" && <CvParseStatusControl candidateId={candidateId} status={cvParseStatus} />}
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive shrink-0 ml-auto"
              onClick={() => handleDelete(d.id)}
              disabled={deletingId === d.id}
              title="Delete"
            >
              {deletingId === d.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
            </Button>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      <h3 className="font-medium text-sm">Documents</h3>

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">CVs ({cvs.length}/3)</span>
          <input
            ref={cvInputRef}
            type="file"
            accept=".pdf,.docx"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload("cv", f) }}
          />
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 gap-1 text-xs"
            onClick={() => cvInputRef.current?.click()}
            disabled={uploading === "cv"}
          >
            {uploading === "cv" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}Upload CV
          </Button>
        </div>
        <DocList docs={cvs} docType="cv" />
      </div>

      <div className="border-t pt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Cover Letters ({cls.length}/3)</span>
          <input
            ref={clInputRef}
            type="file"
            accept=".pdf,.docx"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload("cl", f) }}
          />
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 gap-1 text-xs"
            onClick={() => clInputRef.current?.click()}
            disabled={uploading === "cl"}
          >
            {uploading === "cl" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}Upload Cover Letter
          </Button>
        </div>
        <DocList docs={cls} docType="cl" />
      </div>
    </div>
  )
}
