import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { hasModuleAccessForUser } from "@/lib/auth-helpers"
import { isContractIncomplete } from "@/lib/recruitment/contract-completeness"

// GET /api/recruitment/contracts/incomplete-count
// Backs the Contractors nav badge — current, non-terminated contracts
// missing award/award level/pay rate/start or finish date.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await hasModuleAccessForUser(supabase, user.id, "recruitment"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: contracts } = await (admin.schema("recruitment") as any)
    .from("contracts")
    .select("award, award_level, pay_rate, start_date, finish_date")
    .eq("is_current", true)
    .neq("status", "terminated")

  const count = (contracts ?? []).filter(isContractIncomplete).length
  return NextResponse.json({ count })
}
