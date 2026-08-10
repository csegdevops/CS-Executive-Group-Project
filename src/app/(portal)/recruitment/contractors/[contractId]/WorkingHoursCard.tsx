import { EditWorkScheduleDialog } from "./EditWorkScheduleDialog"
import { normalizeWorkingHours, totalWeeklyHours, type WorkHourEntry } from "./workScheduleUtils"

const DAY_LABELS: Record<string, string> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" }

export interface WorkingHoursData {
  id: string
  status: string
  working_hours: WorkHourEntry[] | null
  lunch_break_minutes: number | null
  start_time_first_day: string | null
}

export function WorkingHoursCard({ contract, onSaved }: { contract: WorkingHoursData; onSaved?: () => void }) {
  const workingHours = normalizeWorkingHours(contract.working_hours)
  const hasScheduleData = Boolean(contract.working_hours)
  const workingDaysCount = workingHours.filter((d) => d.working).length
  const weeklyHours = totalWeeklyHours(workingHours, contract.lunch_break_minutes)

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm">Working hours & schedule</h3>
        {contract.status !== "terminated" && (
          <EditWorkScheduleDialog
            contractId={contract.id}
            workingHours={contract.working_hours}
            lunchBreakMinutes={contract.lunch_break_minutes}
            startTimeFirstDay={contract.start_time_first_day}
            onSaved={onSaved}
          />
        )}
      </div>
      {hasScheduleData ? (
        <>
          <div className="space-y-1 text-sm">
            {workingHours.filter((d) => d.working).map((d) => (
              <p key={d.day}>{DAY_LABELS[d.day]}  {d.start ?? "—"} – {d.end ?? "—"}</p>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Lunch break: {contract.lunch_break_minutes ?? 0} minute(s) · Total: {workingDaysCount} day(s) / {weeklyHours} hour(s) per week
            {contract.start_time_first_day && ` · Start time (first day): ${contract.start_time_first_day}`}
          </p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">No schedule set.</p>
      )}
    </div>
  )
}
