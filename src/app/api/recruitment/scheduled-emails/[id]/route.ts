import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requirePermissionOrSuperAdmin } from "@/lib/auth-helpers"

// DELETE /api/recruitment/scheduled-emails/[id]
// Cancels a scheduled "unsuccessful" email before it sends. Only pending
// rows can be cancelled — once sent/failed/cancelled it's final.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await requirePermissionOrSuperAdmin(supabase, user.id, "recruitment.tasks.edit"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin.schema("recruitment") as any)
    .from("scheduled_emails")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: "Not found or already sent/cancelled" }, { status: 409 })

  return NextResponse.json({ status: "cancelled" })
}
