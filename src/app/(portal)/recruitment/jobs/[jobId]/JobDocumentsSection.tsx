"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { FileText, Upload, Trash2, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface DocumentEntry {
  id: string
  original_name: string | null
  created_at: string
}

interface Props {
  jobId: string
  documents: DocumentEntry[]
}

export function JobDocumentsSection({ jobId, documents }: Props) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleUpload(file: File) {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch(`/api/recruitment/jobs/${jobId}/documents`, { method: "POST", body: formData })
      if (!res.ok) { toast.error("Upload failed"); return }
      toast.success("Document uploaded")
      router.refresh()
    } catch {
      toast.error("Network error")
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  async function handleDelete(documentId: string) {
    setDeletingId(documentId)
    try {
      const res = await fetch(`/api/recruitment/jobs/${jobId}/documents/${documentId}`, { method: "DELETE" })
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

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm">Candidate Information Packs</h3>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f) }}
        />
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 gap-1 text-xs"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}Upload
        </Button>
      </div>

      {documents.length === 0 ? (
        <p className="text-xs text-muted-foreground">No documents on file.</p>
      ) : (
        <div className="space-y-1.5">
          {documents.map((d) => (
            <div key={d.id} className="flex items-center gap-2 text-sm">
              <a
                href={`/api/recruitment/jobs/${jobId}/documents/${d.id}`}
                className="flex items-center gap-1.5 text-primary hover:underline min-w-0"
                title={d.original_name ?? undefined}
              >
                <FileText className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{d.original_name ?? "Document"}</span>
              </a>
              <span className="text-xs text-muted-foreground shrink-0 ml-auto">
                {new Date(d.created_at).toLocaleDateString("en-AU")}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => handleDelete(d.id)}
                disabled={deletingId === d.id}
                title="Delete"
              >
                {deletingId === d.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
