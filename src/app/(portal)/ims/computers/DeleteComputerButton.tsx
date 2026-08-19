"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Trash2, Loader2 } from "lucide-react"
import { toast } from "sonner"

export function DeleteComputerButton({ computerId, hostname }: { computerId: string; hostname: string }) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!confirm(`Delete "${hostname}"? This also removes its logins.`)) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/ims/computers/${computerId}`, { method: "DELETE" })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? "Failed to delete computer")
        return
      }
      toast.success("Computer deleted")
      router.refresh()
    } catch {
      toast.error("Network error")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-1 text-destructive hover:bg-destructive/10"
      disabled={deleting}
      onClick={handleDelete}
    >
      {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
      Delete
    </Button>
  )
}
