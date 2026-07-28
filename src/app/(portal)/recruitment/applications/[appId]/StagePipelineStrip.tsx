import { cn } from "@/lib/utils"

const STAGE_COLORS: Record<string, string> = {
  applied: "bg-slate-100 text-slate-700", screening: "bg-blue-50 text-blue-700",
  shortlisted: "bg-indigo-50 text-indigo-700", interview_1: "bg-violet-50 text-violet-700",
  interview_2: "bg-purple-50 text-purple-700", reference_check: "bg-amber-50 text-amber-700",
  offer: "bg-orange-50 text-orange-700", placed: "bg-green-50 text-green-700",
  withdrawn: "bg-gray-100 text-gray-500", rejected: "bg-red-50 text-red-600",
}

const PIPELINE_STAGES = ["applied", "screening", "shortlisted", "interview_1", "interview_2", "reference_check", "offer", "placed"]
const STAGE_LABELS: Record<string, string> = {
  applied: "Applied", screening: "Screening", shortlisted: "Shortlisted",
  interview_1: "Interview 1", interview_2: "Interview 2",
  reference_check: "Ref Check", offer: "Offer", placed: "Placed",
  withdrawn: "Withdrawn", rejected: "Rejected",
}

export function StagePipelineStrip({ stage }: { stage: string }) {
  if (["withdrawn", "rejected"].includes(stage)) return null

  const currentStageIdx = PIPELINE_STAGES.indexOf(stage)

  return (
    <div className="flex flex-wrap gap-1.5 mb-6">
      {PIPELINE_STAGES.map((s, i) => {
        const done = i < currentStageIdx
        const curr = i === currentStageIdx
        return (
          <div key={s} className={cn(
            "px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
            curr  ? cn(STAGE_COLORS[s], "ring-2 ring-inset ring-current font-semibold") :
            done  ? "bg-green-500/10 text-green-700" :
                    "bg-muted/50 text-muted-foreground"
          )}>
            {STAGE_LABELS[s]}
          </div>
        )
      })}
    </div>
  )
}
