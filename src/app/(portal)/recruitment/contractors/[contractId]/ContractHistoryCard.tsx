import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface SiblingContract {
  id: string
  contract_number: string | null
  status: string
  start_date: string | null
  finish_date: string | null
  is_current: boolean
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-50 text-green-700",
  expired: "bg-gray-100 text-gray-500",
  terminated: "bg-red-50 text-red-600",
}

function formatDate(d: string | null): string {
  return d ? new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "Ongoing"
}

// Reproduces the legacy system's "click into GER.06BB5-1/-2/-3" behavior —
// every renewal creates its own contracts row (see renew/route.ts), and this
// lists the siblings sharing the same placement_id so any of them can be
// opened as their own read-only historical contract page.
export function ContractHistoryCard({ contracts, currentId }: { contracts: SiblingContract[]; currentId: string }) {
  if (contracts.length <= 1) return null

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="font-medium text-sm mb-3">Contract history</h3>
      <ol className="space-y-2">
        {contracts.map((c) => (
          <li key={c.id}>
            <Link
              href={`/recruitment/contractors/${c.id}`}
              className={cn(
                "flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50",
                c.id === currentId && "bg-muted/50"
              )}
            >
              <span className="font-medium">
                {c.contract_number ?? "(no number)"}
                {c.id === currentId && <span className="text-xs text-muted-foreground"> — this contract</span>}
              </span>
              <span className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-muted-foreground">{formatDate(c.start_date)} – {formatDate(c.finish_date)}</span>
                <Badge variant="outline" className={cn("text-xs", STATUS_COLORS[c.status] ?? "")}>
                  {c.status[0].toUpperCase() + c.status.slice(1)}
                </Badge>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  )
}
