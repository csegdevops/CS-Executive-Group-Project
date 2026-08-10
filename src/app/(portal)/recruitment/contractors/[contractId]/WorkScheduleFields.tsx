"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { DAYS, type WeekDay, type WorkHourEntry } from "./workScheduleUtils"

export type { WeekDay, WorkHourEntry } from "./workScheduleUtils"
export { defaultWorkingHours, normalizeWorkingHours, totalWeeklyHours } from "./workScheduleUtils"

export function WorkScheduleFields({ value, onChange }: { value: WorkHourEntry[]; onChange: (v: WorkHourEntry[]) => void }) {
  function update(day: WeekDay, patch: Partial<WorkHourEntry>) {
    onChange(value.map((e) => (e.day === day ? { ...e, ...patch } : e)))
  }

  return (
    <div className="space-y-1.5">
      {DAYS.map(({ key, label }) => {
        const entry = value.find((e) => e.day === key) ?? { day: key, start: null, end: null, working: false }
        return (
          <div key={key} className="flex items-center gap-2 text-sm">
            <label className="flex items-center gap-1.5 w-14 shrink-0">
              <Checkbox checked={entry.working} onCheckedChange={(c) => update(key, { working: !!c })} />
              {label}
            </label>
            <Input
              type="time" className="h-8"
              value={entry.start ?? ""} disabled={!entry.working}
              onChange={(e) => update(key, { start: e.target.value || null })}
            />
            <span className="text-muted-foreground">–</span>
            <Input
              type="time" className="h-8"
              value={entry.end ?? ""} disabled={!entry.working}
              onChange={(e) => update(key, { end: e.target.value || null })}
            />
          </div>
        )
      })}
    </div>
  )
}
