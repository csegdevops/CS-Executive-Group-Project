"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Trash2, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface Props {
  applicationId: string
  /** Called after a successful delete, in addition to router.refresh() — e.g. close a sheet. */
  onDeleted?: () => void
  /** If provided, navigate here after a successful delete (the current detail page no longer has anything to show). */
  redirectTo?: string
}

export function DeleteApplicationButton({ applicationId, onDeleted, redirectTo }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/recruitment/applications/${applicationId}`, { method: "DELETE" })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error ?? "Failed to delete application")
        return
      }
      toast.success("Application deleted")
      setOpen(false)
      router.refresh()
      onDeleted?.()
      if (redirectTo) router.push(redirectTo)
    } catch {
      toast.error("Network error")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 text-destructive hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-3.5 w-3.5" />Delete
      </Button>

      <Dialog open={open} onOpenChange={(o) => !deleting && setOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Delete this application?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            This permanently deletes the application and its stage history, and removes any CV/cover letter attached
            to it specifically. The candidate&apos;s own profile and document history are not affected. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Delete application
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
