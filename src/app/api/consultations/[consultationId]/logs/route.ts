import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ consultationId: string }> }
) {
  const { consultationId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Verify user can read this consultation (RLS check)
  const { data: consultation } = await supabase
    .schema("regulatory")
    .from("consultations")
    .select("id")
    .eq("id", consultationId)
    .single()
  if (!consultation) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const admin = createAdminClient()

  const { data: logs, error } = await admin
    .schema("regulatory")
    .from("consultation_logs")
    .select("id, user_id, action, details, created_at")
    .eq("consultation_id", consultationId)
    .order("created_at", { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!logs || logs.length === 0) return NextResponse.json([])

  // Fetch user display names
  const userIds = [...new Set(logs.map((l) => l.user_id))]
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name")
    .in("id", userIds)

  const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? "Unknown"]))

  const result = logs.map((l) => ({
    ...l,
    user_name: nameMap.get(l.user_id) ?? "Unknown",
  }))

  return NextResponse.json(result)
}
