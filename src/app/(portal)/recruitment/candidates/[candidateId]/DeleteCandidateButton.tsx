"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Trash2, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface Props {
  candidateId: string
  candidateName: string
  redirectTo: string
}

export function DeleteCandidateButton({ candidateId, candidateName, redirectTo }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/recruitment/candidates/${candidateId}`, { method: "DELETE" })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error ?? "Failed to delete candidate")
        return
      }
      toast.success("Candidate deleted")
      setOpen(false)
      router.push(redirectTo)
      router.refresh()
    } catch {
      toast.error("Network error")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-muted-foreground hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-3.5 w-3.5 mr-1" />Delete
      </Button>

      <Dialog open={open} onOpenChange={(o) => !deleting && setOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Delete {candidateName}&apos;s profile?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            This permanently deletes this candidate&apos;s profile, including their notes, skills/education tags,
            and CV/cover letter history. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Delete candidate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
