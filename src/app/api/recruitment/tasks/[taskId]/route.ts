import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { z } from "zod"

const patchSchema = z.object({
  status: z.enum(["open", "in_progress", "completed", "cancelled"]).optional(),
  assigned_to: z.string().uuid().optional().nullable(),
  due_date: z.string().datetime().optional().nullable(),
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
})

// PATCH /api/recruitment/tasks/[taskId]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { taskId } = await params
  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const update: Record<string, unknown> = { ...parsed.data }
  const newStatus = parsed.data.status as string | undefined
  if (newStatus === "completed") {
    update.completed_at = new Date().toISOString()
  } else if (newStatus) {
    update.completed_at = null
  }

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin.schema("recruitment") as any)
    .from("tasks")
    .update(update)
    .eq("id", taskId)
    .select("id, task_type, title, status, assigned_to, due_date, completed_at, updated_at")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
