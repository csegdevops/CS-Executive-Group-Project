"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Trash2, Loader2 } from "lucide-react"
import { toast } from "sonner"

export function DeleteCvButton({ candidateId, docType }: { candidateId: string; docType: "cv" | "cl" }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/recruitment/candidates/${candidateId}/cv?type=${docType}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error ?? "Delete failed")
        return
      }
      toast.success(docType === "cv" ? "CV deleted" : "Cover letter deleted")
      setConfirming(false)
      router.refresh()
    } catch {
      toast.error("Network error")
    } finally {
      setDeleting(false)
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-destructive">Delete?</span>
        <Button size="sm" variant="destructive" className="h-6 px-2 text-xs" onClick={handleDelete} disabled={deleting}>
          {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Confirm"}
        </Button>
        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setConfirming(false)} disabled={deleting}>
          Cancel
        </Button>
      </div>
    )
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
      onClick={() => setConfirming(true)}
      title={docType === "cv" ? "Delete CV" : "Delete cover letter"}
    >
      <Trash2 className="h-3 w-3" />
    </Button>
  )
}
