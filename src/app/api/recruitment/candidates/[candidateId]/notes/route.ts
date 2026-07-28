import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requirePermissionOrSuperAdmin } from "@/lib/auth-helpers"
import { z } from "zod"

// GET /api/recruitment/candidates/[candidateId]/notes
export async function GET(_req: NextRequest, { params }: { params: Promise<{ candidateId: string }> }) {
  const { candidateId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin.schema("recruitment") as any)
    .from("candidate_notes")
    .select("id, content, author_id, created_at, updated_at")
    .eq("candidate_id", candidateId)
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const authorIds = [...new Set(((data ?? []) as { author_id: string }[]).map((n) => n.author_id))]
  const { data: profiles } = authorIds.length
    ? await admin.from("profiles").select("id, full_name").in("id", authorIds)
    : { data: [] }
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]))

  const result = ((data ?? []) as { author_id: string; [k: string]: unknown }[]).map((n) => ({
    ...n,
    author_name: profileMap.get(n.author_id) ?? "Unknown",
  }))

  return NextResponse.json(result)
}

// POST /api/recruitment/candidates/[candidateId]/notes
export async function POST(req: NextRequest, { params }: { params: Promise<{ candidateId: string }> }) {
  const { candidateId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await requirePermissionOrSuperAdmin(supabase, user.id, "recruitment.candidates.edit"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const parsed = z.object({ content: z.string().min(1) }).safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Content required" }, { status: 400 })

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin.schema("recruitment") as any)
    .from("candidate_notes")
    .insert({
      candidate_id: candidateId,
      author_id: user.id,
      content: parsed.data.content,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data, { status: 201 })
}

// DELETE /api/recruitment/candidates/[candidateId]/notes?note_id=...
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ candidateId: string }> }) {
  const { candidateId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const noteId = req.nextUrl.searchParams.get("note_id")
  if (!noteId) return NextResponse.json({ error: "note_id required" }, { status: 400 })

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: note } = await (admin.schema("recruitment") as any)
    .from("candidate_notes")
    .select("author_id")
    .eq("id", noteId)
    .eq("candidate_id", candidateId)
    .single()

  if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (note.author_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin.schema("recruitment") as any)
    .from("candidate_notes")
    .delete()
    .eq("id", noteId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
