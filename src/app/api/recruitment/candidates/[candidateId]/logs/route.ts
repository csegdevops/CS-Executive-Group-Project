import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// GET /api/recruitment/candidates/[candidateId]/logs — super_admin only.
// Registration + profile-change audit trail, populated by
// trg_log_candidate_change (see 20260811000004_candidate_logs.sql) rather
// than app-level calls, so it covers every write path into candidates.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ candidateId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role !== "super_admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { candidateId } = await params
  const admin = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: logs, error } = await (admin.schema("recruitment") as any)
    .from("candidate_logs")
    .select("id, action, details, performed_by, created_at")
    .eq("candidate_id", candidateId)
    .order("created_at", { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!logs || logs.length === 0) return NextResponse.json([])

  const userIds = [...new Set(logs.map((l: { performed_by: string | null }) => l.performed_by).filter(Boolean))] as string[]
  const { data: profiles } = userIds.length
    ? await admin.from("profiles").select("id, full_name").in("id", userIds)
    : { data: [] }
  const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? "Unknown"]))

  const result = logs.map((l: Record<string, unknown>) => ({
    ...l,
    performed_by_name: l.performed_by ? nameMap.get(l.performed_by as string) ?? "Unknown" : null,
  }))

  return NextResponse.json(result)
}
