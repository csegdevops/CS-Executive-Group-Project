import { requireModuleAccess } from "@/lib/auth-helpers"
import { createAdminClient } from "@/lib/supabase/admin"
import { PageHeader } from "@/components/layout/PageHeader"
import { ApplicationsListClient } from "./ApplicationsListClient"

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ job_id?: string; stage?: string; source?: string }>
}) {
  await requireModuleAccess("recruitment")
  const { job_id, stage, source } = await searchParams

  const admin = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (admin.schema("recruitment") as any)
    .from("applications")
    .select(`
      id, job_id, candidate_id, source_channel, stage,
      cv_storage_key, cv_original_name, notes, created_at, updated_at
    `)
    .order("created_at", { ascending: false })
    .limit(500)

  if (job_id) query = query.eq("job_id", job_id)
  if (stage)  query = query.eq("stage", stage)
  if (source) query = query.eq("source_channel", source)

  const { data: applications } = await query

  // Hydrate candidate + job data
  const candIds = [...new Set((applications ?? []).map((a: { candidate_id: string }) => a.candidate_id))]
  const jobIds  = [...new Set((applications ?? []).map((a: { job_id: string }) => a.job_id))]

  const [{ data: candidates }, { data: jobs }] = await Promise.all([
    candIds.length
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (admin.schema("recruitment") as any)
          .from("candidates")
          .select("id, first_name, last_name, email, current_title, profile_completeness_pct")
          .in("id", candIds)
      : Promise.resolve({ data: [] }),
    jobIds.length
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (admin.schema("recruitment") as any)
          .from("jobs")
          .select("id, title, reference_number, company_id, status")
          .in("id", jobIds)
      : Promise.resolve({ data: [] }),
  ])

  const companyIds = [...new Set((jobs ?? []).map((j: { company_id: string }) => j.company_id))] as string[]
  const { data: companies } = companyIds.length
    ? await admin.from("companies").select("id, name").in("id", companyIds)
    : { data: [] }

  const candMap    = Object.fromEntries((candidates ?? []).map((c: Record<string, unknown>) => [c.id, c]))
  const jobMap     = Object.fromEntries((jobs ?? []).map((j: Record<string, unknown>) => [j.id, j]))
  const companyMap = Object.fromEntries((companies ?? []).map((c: { id: string; name: string }) => [c.id, c.name]))

  const enriched = (applications ?? []).map((a: Record<string, unknown>) => {
    const cand = candMap[a.candidate_id as string] as Record<string, unknown> | undefined
    const job  = jobMap[a.job_id as string] as Record<string, unknown> | undefined
    return {
      ...a,
      candidate_name: cand ? `${cand.first_name} ${cand.last_name}` : null,
      candidate_email: cand?.email ?? null,
      candidate_title: cand?.current_title ?? null,
      job_title: job?.title ?? null,
      job_reference: job?.reference_number ?? null,
      company_name: job ? companyMap[job.company_id as string] ?? null : null,
    }
  })

  const jobOptions = (jobs ?? []).map((j: Record<string, unknown>) => ({
    id: j.id as string,
    title: `${j.reference_number ?? ""} ${j.title}`.trim(),
  }))

  return (
    <div>
      <PageHeader title="Applications" description="All candidate applications across jobs" />
      <ApplicationsListClient applications={enriched} jobOptions={jobOptions} />
    </div>
  )
}
