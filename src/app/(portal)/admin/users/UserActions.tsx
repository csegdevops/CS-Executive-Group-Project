"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

export function UserActions({ userId, isActive, currentUserId }: { userId: string; isActive: boolean; currentUserId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const isSelf = userId === currentUserId

  async function toggle() {
    setLoading(true)
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !isActive }),
      })
      if (res.ok) {
        toast.success(isActive ? "User deactivated" : "User activated")
        router.refresh()
      } else {
        toast.error("Failed to update user")
      }
    } catch {
      toast.error("Network error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggle}
      disabled={loading || (isSelf && isActive)}
      title={isSelf && isActive ? "You cannot deactivate your own account" : undefined}
      className={isActive && !isSelf ? "text-destructive hover:bg-destructive/10" : ""}
    >
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : isActive ? "Deactivate" : "Activate"}
    </Button>
  )
}
