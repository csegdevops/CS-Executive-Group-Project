"use client"

import { useState } from "react"
import { PERMISSION_CATALOG, MODULE_LABELS } from "@/lib/permissions"
import { cn } from "@/lib/utils"
import type { Module } from "@/types/database"

const TABS: (Module | "timesheets")[] = ["regulatory", "recruitment", "crm", "timesheets"]

export function PermissionsPicker({
  selected,
  onChange,
}: {
  selected: string[]
  onChange: (next: string[]) => void
}) {
  const [activeTab, setActiveTab] = useState<Module | "timesheets">("regulatory")

  function toggle(key: string) {
    onChange(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key])
  }

  return (
    <div>
      <div className="flex gap-1 border-b mb-4">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            disabled={tab === "timesheets"}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === "timesheets"
                ? "border-transparent text-muted-foreground/40 cursor-not-allowed"
                : activeTab === tab
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab === "timesheets" ? "Timesheets" : MODULE_LABELS[tab]}
          </button>
        ))}
      </div>

      {activeTab === "timesheets" ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Timesheets module coming soon.</p>
      ) : (
        <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
          {PERMISSION_CATALOG[activeTab].map(({ category, permissions }) => (
            <div key={category}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">{category}</p>
              <div className="space-y-1">
                {permissions.map((p) => (
                  <label key={p.key} className="flex items-center gap-2 text-sm cursor-pointer py-1">
                    <input
                      type="checkbox"
                      checked={selected.includes(p.key)}
                      onChange={() => toggle(p.key)}
                      className="rounded"
                    />
                    {p.label}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
