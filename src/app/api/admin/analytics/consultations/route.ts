import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

async function requireAnalyticsAccess(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role === "super_admin") return user
  const { data: access } = await supabase
    .from("user_module_access")
    .select("access_level")
    .eq("user_id", user.id)
    .eq("module", "regulatory")
    .eq("access_level", "admin")
    .maybeSingle()
  if (!access) return null
  return user
}

function fmtMonth(iso: string) {
  // "2024-01" → "Jan '24"
  const [y, m] = iso.split("-")
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
  return `${months[parseInt(m) - 1]} '${y.slice(2)}`
}

function monthsBetween(from: string, to: string): string[] {
  const months: string[] = []
  const [fy, fm] = from.split("-").map(Number)
  const [ty, tm] = to.split("-").map(Number)
  let y = fy, m = fm
  while (y < ty || (y === ty && m <= tm)) {
    months.push(`${y}-${String(m).padStart(2, "0")}`)
    m++
    if (m > 12) { m = 1; y++ }
  }
  return months
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const caller = await requireAnalyticsAccess(supabase)
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { searchParams } = new URL(request.url)
  // Default: last 12 months
  const now = new Date()
  const defaultTo   = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const defaultFrom = (() => {
    const d = new Date(now); d.setMonth(d.getMonth() - 11)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  })()

  const fromMonth = searchParams.get("from") ?? defaultFrom  // "YYYY-MM"
  const toMonth   = searchParams.get("to")   ?? defaultTo

  const fromDate = `${fromMonth}-01T00:00:00.000Z`
  // Compute the actual last day of toMonth — hardcoding 31 breaks for months with fewer days
  const [toY, toM] = toMonth.split("-").map(Number)
  const lastDay = new Date(toY, toM, 0).getDate()   // new Date(y, m, 0) = last day of month m
  const toDate  = `${toMonth}-${String(lastDay).padStart(2, "0")}T23:59:59.999Z`

  const admin = createAdminClient()

  // Fetch all consultations in range
  const { data: consultations, error: cErr } = await admin
    .schema("regulatory")
    .from("consultations")
    .select("id, status, created_at, company_id")
    .gte("created_at", fromDate)
    .lte("created_at", toDate)

  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 })
  const rows = consultations ?? []

  // Fetch company names
  const companyIds = [...new Set(rows.map((r) => r.company_id).filter(Boolean))]
  const { data: companies } = companyIds.length
    ? await admin.from("companies").select("id, name").in("id", companyIds)
    : { data: [] }
  const companyName = new Map((companies ?? []).map((c) => [c.id, c.name]))

  // Fetch consultant assignments for these consultations
  const consultationIds = rows.map((r) => r.id)
  let consultantAssignments: { consultation_id: string; consultant_id: string }[] = []
  if (consultationIds.length) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: ca } = await (admin.schema("regulatory") as any)
      .from("consultation_consultants")
      .select("consultation_id, consultant_id")
      .in("consultation_id", consultationIds)
    consultantAssignments = (ca ?? []) as typeof consultantAssignments
  }

  // Fetch consultant profiles
  const consultantIds = [...new Set(consultantAssignments.map((a) => a.consultant_id))]
  const { data: profiles } = consultantIds.length
    ? await admin.from("profiles").select("id, full_name").in("id", consultantIds)
    : { data: [] }
  const consultantName = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? "Unknown"]))

  const statuses = ["draft", "in_progress", "under_review", "completed", "archived"] as const
  type Status = typeof statuses[number]
  const zero = () => Object.fromEntries(statuses.map((s) => [s, 0])) as Record<Status, number>

  // ── Monthly trend ──────────────────────────────────────────────────────────
  const monthlyMap = new Map<string, Record<Status, number>>()
  for (const r of rows) {
    const month = r.created_at.slice(0, 7)
    const entry = monthlyMap.get(month) ?? zero()
    entry[r.status as Status] = (entry[r.status as Status] ?? 0) + 1
    monthlyMap.set(month, entry)
  }
  const allMonths = monthsBetween(fromMonth, toMonth)
  const monthly = allMonths.map((month) => ({
    month,
    label: fmtMonth(month),
    ...(monthlyMap.get(month) ?? zero()),
    total: Object.values(monthlyMap.get(month) ?? zero()).reduce((a, b) => a + b, 0),
  }))

  // ── Per company ────────────────────────────────────────────────────────────
  const companyMap = new Map<string, Record<Status, number> & { total: number }>()
  for (const r of rows) {
    const name = companyName.get(r.company_id) ?? "Unknown"
    const entry = companyMap.get(name) ?? { ...zero(), total: 0 }
    entry[r.status as Status]++
    entry.total++
    companyMap.set(name, entry)
  }
  const byCompany = [...companyMap.entries()]
    .map(([company, counts]) => ({ company, ...counts }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 12)

  // ── Per consultant ─────────────────────────────────────────────────────────
  const consultantMap = new Map<string, number>()
  for (const a of consultantAssignments) {
    const name = consultantName.get(a.consultant_id) ?? "Unknown"
    consultantMap.set(name, (consultantMap.get(name) ?? 0) + 1)
  }
  const byConsultant = [...consultantMap.entries()]
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 12)

  // ── Status totals ──────────────────────────────────────────────────────────
  const statusTotals = statuses.map((s) => ({
    status: s,
    label: s.replace("_", " ").replace(/^\w/, (c) => c.toUpperCase()),
    count: rows.filter((r) => r.status === s).length,
  }))

  const companiesInvolved = companyIds.filter((id) =>
    rows.some((r) => r.company_id === id)
  ).length

  return NextResponse.json({
    monthly,
    byCompany,
    byConsultant,
    statusTotals,
    total: rows.length,
    companiesInvolved,
    consultantsInvolved: consultantIds.length,
    range: { from: fromMonth, to: toMonth },
  })
}
