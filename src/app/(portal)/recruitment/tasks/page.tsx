import { requireModuleAccess } from "@/lib/auth-helpers"
import { createAdminClient } from "@/lib/supabase/admin"
import { PageHeader } from "@/components/layout/PageHeader"
import { TasksClient } from "./TasksClient"

export default async function TasksPage() {
  const user = await requireModuleAccess("recruitment")
  const admin = createAdminClient()

  const [{ data: tasks }, { data: profiles }] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin.schema("recruitment") as any)
      .from("tasks")
      .select(`
        id, task_type, title, description, status,
        placement_id, job_id, candidate_id,
        assigned_to, assigned_by, due_date, completed_at,
        created_at, updated_at
      `)
      .neq("status", "cancelled")
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(300),
    admin.from("profiles").select("id, full_name").order("full_name"),
  ])

  // Hydrate candidate and job names
  const candIds = [...new Set((tasks ?? []).filter((t: { candidate_id: string | null }) => t.candidate_id).map((t: { candidate_id: string }) => t.candidate_id))]
  const jobIds  = [...new Set((tasks ?? []).filter((t: { job_id: string | null }) => t.job_id).map((t: { job_id: string }) => t.job_id))]

  const [{ data: candidates }, { data: jobs }] = await Promise.all([
    candIds.length
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (admin.schema("recruitment") as any)
          .from("candidates")
          .select("id, first_name, last_name")
          .in("id", candIds)
      : Promise.resolve({ data: [] }),
    jobIds.length
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (admin.schema("recruitment") as any)
          .from("jobs")
          .select("id, title, reference_number")
          .in("id", jobIds)
      : Promise.resolve({ data: [] }),
  ])

  const candMap = Object.fromEntries((candidates ?? []).map((c: Record<string, unknown>) => [c.id, `${c.first_name} ${c.last_name}`]))
  const jobMap  = Object.fromEntries((jobs ?? []).map((j: Record<string, unknown>) => [j.id, j]))
  const profMap = Object.fromEntries((profiles ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name]))

  const enriched = (tasks ?? []).map((t: Record<string, unknown>) => ({
    ...t,
    candidate_name: t.candidate_id ? (candMap[t.candidate_id as string] ?? null) : null,
    job_title:      t.job_id ? (jobMap[t.job_id as string] as Record<string, unknown> | undefined)?.title ?? null : null,
    job_reference:  t.job_id ? (jobMap[t.job_id as string] as Record<string, unknown> | undefined)?.reference_number ?? null : null,
    assigned_to_name: t.assigned_to ? (profMap[t.assigned_to as string] ?? null) : null,
  }))

  return (
    <div>
      <PageHeader title="Tasks" description="Finance, compliance, and general tasks" />
      <TasksClient
        tasks={enriched}
        profiles={(profiles ?? []).map((p: { id: string; full_name: string | null }) => ({ id: p.id, name: p.full_name ?? "Unknown" }))}
        currentUserId={user.id}
      />
    </div>
  )
}
