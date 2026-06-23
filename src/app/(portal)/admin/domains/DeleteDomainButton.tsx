"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Trash2, Loader2 } from "lucide-react"

export function DeleteDomainButton({ domainId, domain }: { domainId: string; domain: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    if (!confirm(`Remove "${domain}" from the allow-list? Users with this domain will no longer be able to register.`)) return
    setLoading(true)

    const res = await fetch(`/api/admin/domains/${domainId}`, { method: "DELETE" })
    setLoading(false)

    if (res.ok) {
      router.refresh()
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-destructive hover:bg-destructive/10 h-7 w-7 p-0"
      onClick={handleDelete}
      disabled={loading}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
    </Button>
  )
}
