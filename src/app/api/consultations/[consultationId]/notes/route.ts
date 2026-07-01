import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { logConsultationEvent } from "@/lib/consultation-log"
import { NextResponse } from "next/server"
import { z } from "zod"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ consultationId: string }> }
) {
  const { consultationId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin.schema("regulatory") as any)
    .from("consultation_notes")
    .select("id, content, author_id, milestone, created_at, updated_at")
    .eq("consultation_id", consultationId)
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Attach author names from profiles
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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ consultationId: string }> }
) {
  const { consultationId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const parsed = z.object({
    content: z.string().min(1),
    milestone: z.enum(["consultation", "chemicals", "volumes", "regulatory", "review", "complete"]).optional(),
  }).safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Content required" }, { status: 400 })

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin.schema("regulatory") as any)
    .from("consultation_notes")
    .insert({
      consultation_id: consultationId,
      author_id: user.id,
      content: parsed.data.content,
      milestone: parsed.data.milestone ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logConsultationEvent(consultationId, user.id, "note_added")

  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ consultationId: string }> }
) {
  const { consultationId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const noteId = searchParams.get("note_id")
  if (!noteId) return NextResponse.json({ error: "note_id required" }, { status: 400 })

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: note } = await (admin.schema("regulatory") as any)
    .from("consultation_notes")
    .select("author_id")
    .eq("id", noteId)
    .eq("consultation_id", consultationId)
    .single()

  if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (note.author_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin.schema("regulatory") as any)
    .from("consultation_notes")
    .delete()
    .eq("id", noteId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
