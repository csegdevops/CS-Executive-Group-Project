"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { FileText, Upload } from "lucide-react"
import { toast } from "sonner"
import { DocumentPreviewSheet, type DocumentPreviewTarget } from "@/components/recruitment/DocumentPreviewSheet"

export function ContractDocumentUpload({
  contractId, documentName, editable, onSaved,
}: {
  contractId: string
  documentName: string | null
  editable: boolean
  onSaved?: () => void
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<DocumentPreviewTarget | null>(null)

  async function handleFile(file: File) {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch(`/api/recruitment/contracts/${contractId}/document`, { method: "POST", body: formData })
      if (!res.ok) { toast.error("Failed to upload document"); return }
      toast.success("Contract document uploaded")
      router.refresh()
      onSaved?.()
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="font-medium text-sm mb-3">Contract document</h3>
      {documentName ? (
        <button
          type="button"
          onClick={() =>
            setPreview({
              inlineUrl: `/api/recruitment/contracts/${contractId}/document?disposition=inline`,
              downloadUrl: `/api/recruitment/contracts/${contractId}/document`,
              fileName: documentName,
              title: "Contract document",
            })
          }
          className="flex items-center gap-2 text-sm text-primary hover:underline mb-2"
        >
          <FileText className="h-4 w-4" />{documentName}
        </button>
      ) : (
        <p className="text-xs text-muted-foreground mb-2">No document uploaded yet.</p>
      )}

      {editable && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />
          <Button size="sm" variant="outline" disabled={uploading} onClick={() => inputRef.current?.click()}>
            <Upload className="h-3.5 w-3.5 mr-1.5" />{uploading ? "Uploading…" : documentName ? "Replace document" : "Upload document"}
          </Button>
        </>
      )}

      <DocumentPreviewSheet target={preview} onOpenChange={(open) => { if (!open) setPreview(null) }} />
    </div>
  )
}
