"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Loader2, Users, CheckCircle2, Circle } from "lucide-react"
import { toast } from "sonner"

interface ConsultantUser {
  id: string
  full_name: string | null
  is_assigned: boolean
}

export function ManageConsultantsDialog({ consultationId }: { consultationId: string }) {
  const router = useRouter()
  const [open, setOpen]           = useState(false)
  const [users, setUsers]         = useState<ConsultantUser[]>([])
  const [loading, setLoading]     = useState(false)
  const [toggling, setToggling]   = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/consultations/${consultationId}/consultants`)
      if (!res.ok) { toast.error("Failed to load users"); return }
      setUsers(await res.json())
    } catch {
      toast.error("Network error")
    } finally {
      setLoading(false)
    }
  }, [consultationId])

  useEffect(() => { if (open) fetchUsers() }, [open, fetchUsers])

  async function toggle(user: ConsultantUser) {
    setToggling(user.id)
    try {
      if (user.is_assigned) {
        const res = await fetch(
          `/api/consultations/${consultationId}/consultants?user_id=${user.id}`,
          { method: "DELETE" }
        )
        if (!res.ok) { toast.error("Failed to unassign"); return }
        setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, is_assigned: false } : u))
        toast.success(`${user.full_name ?? "User"} removed`)
      } else {
        const res = await fetch(`/api/consultations/${consultationId}/consultants`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: user.id }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          toast.error(err.error ?? "Failed to assign")
          return
        }
        setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, is_assigned: true } : u))
        toast.success(`${user.full_name ?? "User"} assigned`)
      }
      router.refresh()
    } catch {
      toast.error("Network error")
    } finally {
      setToggling(null)
    }
  }

  const assigned   = users.filter((u) => u.is_assigned)
  const available  = users.filter((u) => !u.is_assigned)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Users className="h-3.5 w-3.5" />
          Manage Consultants
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm max-h-[70vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Assigned Consultants</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : users.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No regulatory users found.
          </p>
        ) : (
          <div className="flex-1 overflow-y-auto -mx-6 px-6 space-y-0.5">
            {[
              { label: "Assigned", items: assigned },
              { label: "Available", items: available },
            ].map(({ label, items }) =>
              items.length > 0 ? (
                <div key={label}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-3 pb-1">
                    {label} ({items.length})
                  </p>
                  {items.map((u) => (
                    <button
                      key={u.id}
                      disabled={toggling === u.id}
                      onClick={() => toggle(u)}
                      className="w-full flex items-center gap-3 px-2 py-2 rounded-md text-left transition-colors hover:bg-muted/60 disabled:opacity-60 text-sm"
                    >
                      {toggling === u.id ? (
                        <Loader2 className="h-4 w-4 animate-spin shrink-0 text-muted-foreground" />
                      ) : u.is_assigned ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                      ) : (
                        <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className="font-medium">{u.full_name ?? "—"}</span>
                    </button>
                  ))}
                </div>
              ) : null
            )}
          </div>
        )}

        <div className="pt-3 border-t flex justify-between items-center text-xs text-muted-foreground">
          <span>{assigned.length} assigned</span>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
