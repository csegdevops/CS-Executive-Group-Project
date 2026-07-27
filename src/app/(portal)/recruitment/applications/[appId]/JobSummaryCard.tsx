import Link from "next/link"
import { MapPin } from "lucide-react"

export interface JobSummary {
  id: string
  title: string
  reference_number: string | null
  location: string | null
  employment_type: string | null
  company_name: string | null
}

export function JobSummaryCard({ job }: { job: JobSummary | null }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="font-medium text-sm mb-2">Job</h3>
      {job ? (
        <>
          <Link href={`/recruitment/jobs/${job.id}`} className="hover:underline">
            <p className="font-medium">{job.title}</p>
          </Link>
          {job.company_name && <p className="text-sm text-muted-foreground">{job.company_name}</p>}
          {job.location && <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1"><MapPin className="h-3 w-3" />{job.location}</p>}
          {job.employment_type && <p className="text-sm text-muted-foreground capitalize mt-1">{job.employment_type}</p>}
          {job.reference_number && <p className="text-xs font-mono text-muted-foreground mt-1">{job.reference_number}</p>}
        </>
      ) : (
        <p className="font-medium">Unknown</p>
      )}
    </div>
  )
}
