import { cn } from "@/lib/utils"
import type { RegulatoryStatus, RegulatoryFramework } from "@/types/database"

const frameworkLabels: Record<RegulatoryFramework, string> = {
  aicis: "AICIS",
  reach: "REACH",
  tsca: "TSCA",
}

const statusConfig: Record<RegulatoryStatus, { label: string; className: string }> = {
  listed: { label: "Listed", className: "bg-green-100 text-green-800 border-green-200" },
  not_listed: { label: "Not Listed", className: "bg-gray-100 text-gray-700 border-gray-200" },
  exempt: { label: "Exempt", className: "bg-blue-100 text-blue-800 border-blue-200" },
  restricted: { label: "Restricted", className: "bg-red-100 text-red-800 border-red-200" },
  pending: { label: "Pending", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  unknown: { label: "Unknown", className: "bg-gray-50 text-gray-500 border-gray-200" },
}

interface Props {
  framework: RegulatoryFramework
  status: RegulatoryStatus
  showFramework?: boolean
}

export function RegulatoryStatusBadge({ framework, status, showFramework = true }: Props) {
  const config = statusConfig[status] ?? statusConfig.unknown
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium", config.className)}>
      {showFramework && <span className="font-semibold">{frameworkLabels[framework]}</span>}
      {showFramework && <span className="opacity-50">·</span>}
      {config.label}
    </span>
  )
}
