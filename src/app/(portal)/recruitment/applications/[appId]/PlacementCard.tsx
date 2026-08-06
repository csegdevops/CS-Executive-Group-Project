import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2 } from "lucide-react"
import { CreatePlacementDialog } from "./CreatePlacementDialog"
import { ProvisionTimesheetsDialog } from "./ProvisionTimesheetsDialog"

interface Placement {
  id: string
  placement_type: "permanent" | "contract"
  start_date: string
  finish_date: string | null
  pay_rate: number | null
  charge_rate: number | null
  currency: string
}

export function PlacementCard({
  applicationId, jobId, candidateId, candidateName, candidateEmail,
  companyId, companyName, employmentType, placement, contractorId,
}: {
  applicationId: string
  jobId: string
  candidateId: string
  candidateName: string
  candidateEmail: string
  companyId: string | null
  companyName: string | null
  employmentType: string | null
  placement: Placement | null
  contractorId: string | null
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="font-medium text-sm mb-3">Placement</h3>

      {!placement ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Not yet placed. Creating a placement records the contract/permanent hire — a contract placement can then be provisioned for Timesheets Portal access.
          </p>
          {companyId ? (
            <CreatePlacementDialog
              applicationId={applicationId}
              jobId={jobId}
              candidateId={candidateId}
              defaultPlacementType={employmentType === "contract" ? "contract" : "permanent"}
              onCreated={() => {}}
            />
          ) : (
            <p className="text-xs text-destructive">Job has no company on file — cannot create a placement.</p>
          )}
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className={placement.placement_type === "contract" ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-green-50 text-green-700 border-green-200"}>
              {placement.placement_type === "contract" ? "Contract" : "Permanent"}
            </Badge>
          </div>
          <div className="text-muted-foreground text-xs space-y-1">
            <p>{placement.start_date} – {placement.finish_date ?? "Ongoing"}</p>
            {placement.placement_type === "contract" && (placement.pay_rate || placement.charge_rate) && (
              <p>{placement.pay_rate ?? "—"} / {placement.charge_rate ?? "—"} {placement.currency}</p>
            )}
          </div>

          {placement.placement_type === "contract" && companyId && (
            contractorId ? (
              <Link href={`/timesheets/contractors/${contractorId}`} className="flex items-center gap-1.5 text-xs text-green-700 hover:underline w-fit">
                <CheckCircle2 className="h-3.5 w-3.5" />Timesheets access provisioned
              </Link>
            ) : (
              <ProvisionTimesheetsDialog
                placementId={placement.id}
                candidateId={candidateId}
                candidateName={candidateName}
                candidateEmail={candidateEmail}
                companyId={companyId}
                companyName={companyName ?? "—"}
                startDate={placement.start_date}
                finishDate={placement.finish_date}
                payRate={placement.pay_rate}
                chargeRate={placement.charge_rate}
                currency={placement.currency}
              />
            )
          )}
        </div>
      )}
    </div>
  )
}
