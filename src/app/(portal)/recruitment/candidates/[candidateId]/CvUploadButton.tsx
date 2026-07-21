"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Upload, Loader2 } from "lucide-react"
import { toast } from "sonner"

export function CvUploadButton({ candidateId, docType }: { candidateId: string; docType: "cv" | "cl" }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function handleFile(file: File) {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("type", docType)
      const res = await fetch(`/api/recruitment/candidates/${candidateId}/cv`, {
        method: "POST",
        body: formData,
      })
      if (!res.ok) { toast.error("Upload failed"); return }
      toast.success(docType === "cv" ? "CV uploaded — parsing in the background" : "Cover letter uploaded")
      router.refresh()
    } catch {
      toast.error("Network error")
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />
      <Button
        size="sm"
        variant="ghost"
        className="h-6 px-2 gap-1 text-xs"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
        {docType === "cv" ? "Upload CV" : "Upload Cover Letter"}
      </Button>
    </>
  )
}
