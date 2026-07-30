import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export const CRM_STATUS_STYLES: Record<string, string> = {
  lead:     "bg-slate-100 text-slate-700 border-slate-200",
  prospect: "bg-blue-50  text-blue-700  border-blue-200",
  client:   "bg-green-50 text-green-700 border-green-200",
  inactive: "bg-red-50   text-red-700   border-red-200",
}

export function CrmStatusBadge({ status }: { status: string | null }) {
  return (
    <Badge variant="outline" className={cn("text-xs capitalize", CRM_STATUS_STYLES[status ?? "prospect"])}>
      {status ?? "prospect"}
    </Badge>
  )
}

export const STAGE_STYLES: Record<string, string> = {
  lead:        "bg-slate-100 text-slate-700",
  qualified:   "bg-blue-50   text-blue-700",
  proposal:    "bg-purple-50 text-purple-700",
  negotiation: "bg-amber-50  text-amber-700",
  won:         "bg-green-50  text-green-700",
  lost:        "bg-red-50    text-red-700",
}

export function OpportunityStageBadge({ stage }: { stage: string }) {
  return (
    <Badge variant="outline" className={cn("text-xs capitalize", STAGE_STYLES[stage] ?? "")}>
      {stage}
    </Badge>
  )
}
