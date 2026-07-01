"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"

interface Props {
  id: string
  name: string
}

export function ChemicalDeleteButton({ id, name }: Props) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!confirm(
      `Delete "${name}" from the global chemical database?\n\nThis will unlink it from any consultations that reference it. This cannot be undone.`
    )) return

    setDeleting(true)
    try {
      const res = await fetch(`/api/chemicals/${id}`, { method: "DELETE" })
      if (res.ok) {
        toast.success("Chemical deleted from database")
        router.refresh()
      } else {
        const err = await res.json()
        toast.error(err.error ?? "Failed to delete")
      }
    } catch {
      toast.error("Network error")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7 text-muted-foreground hover:text-destructive"
      onClick={handleDelete}
      disabled={deleting}
      title="Delete from global database"
    >
      {deleting
        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
        : <Trash2 className="h-3.5 w-3.5" />
      }
    </Button>
  )
}
