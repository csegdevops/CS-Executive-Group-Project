"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { formatDate } from "@/lib/date-helpers"
import { toast } from "sonner"
import Link from "next/link"

interface Opportunity {
  id: string
  title: string
  stage: string
  value: number | null
  currency: string
  company_id: string
  company_name: string
  assigned_to_name: string | null
  expected_close_date: string | null
  module: string | null
}

const STAGES = ["lead", "qualified", "proposal", "negotiation"] as const

const STAGE_LABELS: Record<string, string> = {
  lead: "Lead", qualified: "Qualified", proposal: "Proposal", negotiation: "Negotiation",
}

const STAGE_COLORS: Record<string, string> = {
  lead:        "bg-slate-100 text-slate-700",
  qualified:   "bg-blue-50 text-blue-700",
  proposal:    "bg-purple-50 text-purple-700",
  negotiation: "bg-amber-50 text-amber-700",
}

interface Props {
  initialOpps: Opportunity[]
}

export function PipelineBoard({ initialOpps }: Props) {
  const [opps, setOpps] = useState<Opportunity[]>(initialOpps)

  function columnOpps(stage: string) {
    return opps.filter(o => o.stage === stage)
  }

  function columnValue(stage: string) {
    return opps.filter(o => o.stage === stage).reduce((sum, o) => sum + (o.value ?? 0), 0)
  }

  async function moveStage(opp: Opportunity, newStage: string) {
    if (opp.stage === newStage) return
    // Optimistic update — won/lost cards disappear from the board (board shows only open stages)
    if (newStage === "won" || newStage === "lost") {
      setOpps(prev => prev.filter(o => o.id !== opp.id))
    } else {
      setOpps(prev => prev.map(o => o.id === opp.id ? { ...o, stage: newStage } : o))
    }
    const res = await fetch(`/api/crm/opportunities/${opp.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: newStage }),
    })
    if (!res.ok) {
      // Revert — restore original stage
      setOpps(prev => {
        const existing = prev.find(o => o.id === opp.id)
        if (existing) return prev.map(o => o.id === opp.id ? { ...o, stage: opp.stage } : o)
        return [{ ...opp }, ...prev]
      })
      toast.error("Failed to update stage")
    } else {
      toast.success(`Moved to ${STAGE_LABELS[newStage]}`)
    }
  }

  const totalValue = opps.reduce((sum, o) => sum + (o.value ?? 0), 0)

  return (
    <div>
      <div className="mb-4 flex items-center gap-4 text-sm text-muted-foreground">
        <span>{opps.length} opportunities</span>
        {totalValue > 0 && <span>Total pipeline: AUD {totalValue.toLocaleString()}</span>}
      </div>
      <div className="grid grid-cols-4 gap-4 overflow-x-auto min-w-0">
        {STAGES.map(stage => {
          const cards = columnOpps(stage)
          const colValue = columnValue(stage)
          return (
            <div key={stage} className="min-w-56">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", STAGE_COLORS[stage])}>
                    {STAGE_LABELS[stage]}
                  </span>
                  <span className="text-xs text-muted-foreground">{cards.length}</span>
                </div>
                {colValue > 0 && <span className="text-xs text-muted-foreground">AUD {colValue.toLocaleString()}</span>}
              </div>

              <div className="space-y-2">
                {cards.length === 0 && (
                  <div className="border-2 border-dashed rounded-lg p-4 text-center text-xs text-muted-foreground">
                    No opportunities
                  </div>
                )}
                {cards.map(opp => (
                  <div key={opp.id} className="border rounded-lg p-3 bg-card hover:shadow-sm transition-shadow">
                    <Link href={`/crm/accounts/${opp.company_id}?tab=pipeline`} className="font-medium text-sm hover:underline block truncate">
                      {opp.title}
                    </Link>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{opp.company_name}</p>
                    <div className="flex items-center justify-between mt-2 gap-1 flex-wrap">
                      {opp.value && (
                        <span className="text-xs font-medium">{opp.currency} {opp.value.toLocaleString()}</span>
                      )}
                      {opp.expected_close_date && (
                        <span className="text-xs text-muted-foreground">{formatDate(opp.expected_close_date)}</span>
                      )}
                    </div>
                    {opp.assigned_to_name && (
                      <p className="text-xs text-muted-foreground mt-1">{opp.assigned_to_name}</p>
                    )}
                    {/* Move buttons */}
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {STAGES.filter(s => s !== stage).map(s => (
                        <button
                          key={s}
                          onClick={() => moveStage(opp, s)}
                          className={cn("text-xs px-1.5 py-0.5 rounded border transition-colors hover:opacity-80", STAGE_COLORS[s])}
                        >
                          {STAGE_LABELS[s]}
                        </button>
                      ))}
                      <button
                        onClick={() => moveStage(opp, "won")}
                        className="text-xs px-1.5 py-0.5 rounded border border-green-300 bg-green-50 text-green-700 hover:bg-green-100 ml-auto"
                      >
                        Won
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
