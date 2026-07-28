import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { findDuplicateClusters } from "@/lib/recruitment/find-duplicate-clusters"

// GET /api/recruitment/candidates/duplicates
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const admin = createAdminClient()
  const result = await findDuplicateClusters(admin)

  return NextResponse.json(result)
}
