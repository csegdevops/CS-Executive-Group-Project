import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { hasModuleAccessForUser } from "@/lib/auth-helpers"

// GET /api/recruitment/contracts?status=&company_id=&candidate_id=
// A "contractor" isn't its own entity — this lists recruitment.contracts
// rows (one per contract-type placement), joined back to the placement,
// job, and candidate. company_id filtering happens in JS below since
// companies lives in the public schema, outside this recruitment-schema
// nested select.
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await hasModuleAccessForUser(supabase, user.id, "recruitment"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const status = req.nextUrl.searchParams.get("status")
  const companyId = req.nextUrl.searchParams.get("company_id")
  const candidateId = req.nextUrl.searchParams.get("candidate_id")

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (admin.schema("recruitment") as any)
    .from("contracts")
    .select(`
      id, contract_number, status, created_at,
      placement:placements(
        id, start_date, finish_date, pay_rate, charge_rate, currency,
        job:jobs(id, title, company_id),
        candidate:candidates(id, first_name, last_name)
      )
    `)
    .eq("is_current", true)
    .order("created_at", { ascending: false })

  if (status) query = query.eq("status", status)
  if (candidateId) query = query.eq("placement.candidate_id", candidateId)

  const { data: contracts, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const companyIds = [
    ...new Set((contracts ?? []).map((c: { placement?: { job?: { company_id: string } } }) => c.placement?.job?.company_id).filter(Boolean)),
  ] as string[]
  const { data: companies } = companyIds.length
    ? await admin.from("companies").select("id, name").in("id", companyIds)
    : { data: [] }
  const companyMap = Object.fromEntries((companies ?? []).map((c: { id: string; name: string }) => [c.id, c.name]))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enriched = (contracts ?? []).map((c: any) => ({
    ...c,
    placement: c.placement
      ? {
          ...c.placement,
          job: c.placement.job ? { ...c.placement.job, company_name: companyMap[c.placement.job.company_id] ?? null } : null,
        }
      : null,
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filtered = companyId ? enriched.filter((c: any) => c.placement?.job?.company_id === companyId) : enriched

  return NextResponse.json(filtered)
}
