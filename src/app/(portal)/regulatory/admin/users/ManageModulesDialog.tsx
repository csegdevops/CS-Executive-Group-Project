"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Settings2, Loader2 } from "lucide-react"
import { toast } from "sonner"

type ModuleAccess = { module: string; access_level: string }

const allModules = ["regulatory", "recruitment", "crm"] as const
const moduleLabels: Record<string, string> = {
  regulatory: "Regulatory",
  recruitment: "Recruitment",
  crm: "CRM",
}

export function ManageModulesDialog({
  userId,
  isSuperAdmin,
  initialAccess,
  allowedModules = [...allModules],
}: {
  userId: string
  isSuperAdmin: boolean
  initialAccess: ModuleAccess[]
  allowedModules?: string[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [access, setAccess] = useState<ModuleAccess[]>(initialAccess)
  const [loading, setLoading] = useState<string | null>(null)

  if (isSuperAdmin) {
    return (
      <Badge variant="secondary" className="text-xs">Full Access</Badge>
    )
  }

  async function setLevel(module: string, level: "admin" | "member" | null) {
    setLoading(module)
    try {
      if (level === null) {
        const res = await fetch(`/api/users/${userId}/modules`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ module }),
        })
        if (!res.ok) { toast.error("Failed to revoke access"); return }
        setAccess((prev) => prev.filter((a) => a.module !== module))
      } else {
        const res = await fetch(`/api/users/${userId}/modules`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ module, access_level: level }),
        })
        if (!res.ok) { toast.error("Failed to update access"); return }
        setAccess((prev) => {
          const existing = prev.find((a) => a.module === module)
          if (existing) return prev.map((a) => a.module === module ? { ...a, access_level: level } : a)
          return [...prev, { module, access_level: level }]
        })
      }
      toast.success("Access updated")
      router.refresh()
    } catch {
      toast.error("Network error")
    } finally {
      setLoading(null)
    }
  }

  const currentAccess = (module: string) => access.find((a) => a.module === module)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <Settings2 className="h-3 w-3" />
          Modules
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Module Access</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          {allModules.filter((mod) => allowedModules.includes(mod)).map((mod) => {
            const current = currentAccess(mod)
            const isLoading = loading === mod
            return (
              <div key={mod} className="flex items-center justify-between gap-4 py-2 border-b last:border-0">
                <span className="text-sm font-medium">{moduleLabels[mod]}</span>
                <div className="flex items-center gap-2">
                  {isLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                  <Button
                    size="sm"
                    variant={current?.access_level === "admin" ? "default" : "outline"}
                    className="text-xs h-7 px-2"
                    disabled={isLoading}
                    onClick={() => setLevel(mod, current?.access_level === "admin" ? "member" : "admin")}
                  >
                    Admin
                  </Button>
                  <Button
                    size="sm"
                    variant={current?.access_level === "member" ? "default" : "outline"}
                    className="text-xs h-7 px-2"
                    disabled={isLoading}
                    onClick={() => setLevel(mod, current?.access_level === "member" ? null : "member")}
                  >
                    Member
                  </Button>
                  {current && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs h-7 px-2 text-destructive hover:bg-destructive/10"
                      disabled={isLoading}
                      onClick={() => setLevel(mod, null)}
                    >
                      Revoke
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
