"use client"

import { useState } from "react"
import { PERMISSION_CATALOG, MODULE_LABELS, type PermissionTab } from "@/lib/permissions"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const TABS: PermissionTab[] = ["regulatory", "recruitment", "timesheets", "platform"]

export function PermissionsPicker({
  selected,
  onChange,
  disabled = false,
}: {
  selected: string[]
  onChange: (next: string[]) => void
  disabled?: boolean
}) {
  const [activeTab, setActiveTab] = useState<PermissionTab>("regulatory")

  function toggle(key: string) {
    if (disabled) return
    onChange(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key])
  }

  const tabKeys = PERMISSION_CATALOG[activeTab].flatMap((c) => c.permissions.map((p) => p.key))
  const allSelected = tabKeys.length > 0 && tabKeys.every((k) => selected.includes(k))

  function selectAll() {
    if (disabled) return
    onChange([...new Set([...selected, ...tabKeys])])
  }

  function selectNone() {
    if (disabled) return
    onChange(selected.filter((k) => !tabKeys.includes(k)))
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2 border-b mb-4">
        <div className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                activeTab === tab
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {MODULE_LABELS[tab]}
            </button>
          ))}
        </div>
        {!disabled && (
          <div className="flex items-center gap-2 pb-2 text-xs">
            <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" disabled={allSelected} onClick={selectAll}>
              Select all
            </Button>
            <span className="text-muted-foreground">·</span>
            <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" disabled={selected.length === 0} onClick={selectNone}>
              Select none
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
        {PERMISSION_CATALOG[activeTab].map(({ category, permissions }) => (
          <div key={category}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">{category}</p>
            <div className="space-y-1.5">
              {permissions.map((p) => (
                <label
                  key={p.key}
                  className={cn(
                    "flex items-start gap-2 text-sm py-0.5",
                    disabled ? "cursor-not-allowed text-muted-foreground" : "cursor-pointer"
                  )}
                >
                  <Checkbox
                    checked={selected.includes(p.key)}
                    disabled={disabled}
                    onCheckedChange={() => toggle(p.key)}
                    className="mt-0.5"
                  />
                  {p.label}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
