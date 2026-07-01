import { requireModuleAccess } from "@/lib/auth-helpers"
import { createAdminClient } from "@/lib/supabase/admin"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Plus } from "lucide-react"
import { JobsListClient } from "./JobsListClient"

export default async function JobsPage() {
  const user = await requireModuleAccess("recruitment")
  const admin = createAdminClient()

  const [{ data: jobs }, { data: companies }, { data: profiles }] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin.schema("recruitment") as any)
      .from("jobs")
      .select(`
        id, title, reference_number, location, employment_type,
        status, security_clearance_required, salary_min, salary_max, salary_currency,
        company_id, assigned_recruiter_id, created_at
      `)
      .order("created_at", { ascending: false })
      .limit(300),
    admin.from("companies").select("id, name").order("name"),
    admin.from("profiles").select("id, full_name").order("full_name"),
  ])

  // Application counts
  const jobIds = (jobs ?? []).map((j: { id: string }) => j.id)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: appRows } = jobIds.length
    ? await (admin.schema("recruitment") as any)
        .from("applications")
        .select("job_id")
        .in("job_id", jobIds)
    : { data: [] }

  const appCountMap: Record<string, number> = {}
  for (const a of appRows ?? []) { appCountMap[a.job_id] = (appCountMap[a.job_id] ?? 0) + 1 }

  const companyMap  = Object.fromEntries((companies ?? []).map((c: { id: string; name: string }) => [c.id, c.name]))
  const profileMap  = Object.fromEntries((profiles ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name]))

  const enrichedJobs = (jobs ?? []).map((j: Record<string, unknown>) => ({
    ...j,
    company_name:      companyMap[j.company_id as string] ?? null,
    recruiter_name:    j.assigned_recruiter_id ? (profileMap[j.assigned_recruiter_id as string] ?? null) : null,
    application_count: appCountMap[j.id as string] ?? 0,
  }))

  return (
    <div>
      <PageHeader title="Jobs" description="All open positions and job orders">
        <Button asChild size="sm">
          <Link href="/recruitment/jobs/new">
            <Plus className="h-4 w-4 mr-1.5" />
            New Job
          </Link>
        </Button>
      </PageHeader>

      <JobsListClient
        jobs={enrichedJobs}
        companies={(companies ?? []).map((c: { id: string; name: string }) => ({ id: c.id, name: c.name }))}
        recruiters={(profiles ?? []).map((p: { id: string; full_name: string | null }) => ({ id: p.id, name: p.full_name ?? "Unknown" }))}
      />
    </div>
  )
}
