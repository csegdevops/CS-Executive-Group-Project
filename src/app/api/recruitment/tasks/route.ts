import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// GET /api/recruitment/tasks?status=open&task_type=...&mine=true
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = req.nextUrl
  const status   = searchParams.get("status")
  const taskType = searchParams.get("task_type")
  const mine     = searchParams.get("mine") === "true"

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (admin.schema("recruitment") as any)
    .from("tasks")
    .select(`
      id, task_type, title, description, status,
      placement_id, job_id, candidate_id,
      assigned_to, assigned_by, due_date, completed_at,
      created_at, updated_at
    `)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(200)

  if (status)   query = query.eq("status", status)
  if (taskType) query = query.eq("task_type", taskType)
  if (mine)     query = query.eq("assigned_to", user.id)

  const { data: tasks, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Hydrate candidate and job names
  const candIds   = [...new Set((tasks ?? []).filter((t: { candidate_id: string | null }) => t.candidate_id).map((t: { candidate_id: string }) => t.candidate_id))]
  const jobIds    = [...new Set((tasks ?? []).filter((t: { job_id: string | null }) => t.job_id).map((t: { job_id: string }) => t.job_id))]
  const userIds   = [...new Set([
    ...(tasks ?? []).filter((t: { assigned_to: string | null }) => t.assigned_to).map((t: { assigned_to: string }) => t.assigned_to),
    ...(tasks ?? []).filter((t: { assigned_by: string | null }) => t.assigned_by).map((t: { assigned_by: string }) => t.assigned_by),
  ])]

  const [{ data: candidates }, { data: jobs }, { data: assignees }] = await Promise.all([
    candIds.length
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (admin.schema("recruitment") as any)
          .from("candidates")
          .select("id, first_name, last_name, email")
          .in("id", candIds)
      : Promise.resolve({ data: [] }),
    jobIds.length
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (admin.schema("recruitment") as any)
          .from("jobs")
          .select("id, title, reference_number")
          .in("id", jobIds)
      : Promise.resolve({ data: [] }),
    userIds.length
      ? admin.from("profiles").select("id, full_name").in("id", userIds as string[])
      : Promise.resolve({ data: [] }),
  ])

  const candMap   = Object.fromEntries((candidates ?? []).map((c: Record<string, unknown>) => [c.id, c]))
  const jobMap    = Object.fromEntries((jobs ?? []).map((j: Record<string, unknown>) => [j.id, j]))
  const userMap   = Object.fromEntries((assignees ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name]))

  const result = (tasks ?? []).map((t: Record<string, unknown>) => ({
    ...t,
    candidate_name: t.candidate_id
      ? (() => { const c = candMap[t.candidate_id as string] as Record<string, unknown> | undefined; return c ? `${c.first_name} ${c.last_name}` : null })()
      : null,
    job_title:      t.job_id ? (jobMap[t.job_id as string] as Record<string, unknown> | undefined)?.title ?? null : null,
    job_reference:  t.job_id ? (jobMap[t.job_id as string] as Record<string, unknown> | undefined)?.reference_number ?? null : null,
    assigned_to_name: t.assigned_to ? userMap[t.assigned_to as string] ?? null : null,
  }))

  return NextResponse.json(result)
}
