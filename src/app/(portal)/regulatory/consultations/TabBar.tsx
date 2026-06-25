"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { List, BarChart2 } from "lucide-react"

const TABS = [
  { key: "list",      label: "Consultations", icon: List },
  { key: "analytics", label: "Analytics",     icon: BarChart2 },
]

export function TabBar({ isAdmin }: { isAdmin: boolean }) {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()
  const activeTab    = searchParams.get("tab") ?? "list"

  if (!isAdmin) return null

  return (
    <div className="flex gap-1 border-b mb-6">
      {TABS.map(({ key, label, icon: Icon }) => {
        const isActive = activeTab === key
        return (
          <button
            key={key}
            onClick={() => {
              const params = new URLSearchParams(searchParams.toString())
              if (key === "list") params.delete("tab")
              else params.set("tab", key)
              router.push(`${pathname}?${params.toString()}`)
            }}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              isActive
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/40"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        )
      })}
    </div>
  )
}
