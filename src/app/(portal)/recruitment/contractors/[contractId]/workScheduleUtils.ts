// Pure helpers — deliberately NOT "use client" so server components (the
// contract detail page) can call them directly. WorkScheduleFields.tsx
// (the interactive editor) imports these rather than redefining them.

export type WeekDay = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"
export interface WorkHourEntry { day: WeekDay; start: string | null; end: string | null; working: boolean }

export const DAYS: { key: WeekDay; label: string }[] = [
  { key: "mon", label: "Mon" }, { key: "tue", label: "Tue" }, { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" }, { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" }, { key: "sun", label: "Sun" },
]

export function defaultWorkingHours(): WorkHourEntry[] {
  const weekdays: WeekDay[] = ["mon", "tue", "wed", "thu", "fri"]
  return DAYS.map(({ key }) => ({ day: key, start: "09:00", end: "17:00", working: weekdays.includes(key) }))
}

// Fills in any missing days (e.g. legacy data that only stored Mon-Fri) so
// the editor always renders all 7 rows.
export function normalizeWorkingHours(value: WorkHourEntry[] | null | undefined): WorkHourEntry[] {
  const byDay = new Map((value ?? []).map((e) => [e.day, e]))
  return DAYS.map(({ key }) => byDay.get(key) ?? { day: key, start: null, end: null, working: false })
}

export function totalWeeklyHours(value: WorkHourEntry[], lunchBreakMinutes: number | null): number {
  let totalMinutes = 0
  for (const e of value) {
    if (!e.working || !e.start || !e.end) continue
    const [sh, sm] = e.start.split(":").map(Number)
    const [eh, em] = e.end.split(":").map(Number)
    const minutes = (eh * 60 + em) - (sh * 60 + sm) - (lunchBreakMinutes ?? 0)
    if (minutes > 0) totalMinutes += minutes
  }
  return Math.round((totalMinutes / 60) * 100) / 100
}
