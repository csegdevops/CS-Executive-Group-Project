import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requirePermissionOrSuperAdmin } from "@/lib/auth-helpers"
import { uploadJobFile, deleteJobFile, downloadJobFile } from "@/lib/storage/job-storage"

// POST /api/recruitment/jobs/[jobId]/hero-image — replace the executive
// search microsite's hero/banner image. Single-slot (unlike job_documents),
// so this just updates the pointer column on the job row, deleting the
// previous image if one existed.
export async function POST(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await requirePermissionOrSuperAdmin(supabase, user.id, "recruitment.jobs.edit"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { jobId } = await params
  const formData = await req.formData()
  const file = formData.get("file")

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 })
  }

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recruitment = admin.schema("recruitment") as any

  const { data: job } = await recruitment.from("jobs").select("hero_image_storage_key").eq("id", jobId).single()
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const ext = file.name.split(".").pop() || "jpg"
  const path = `jobs/${jobId}/hero.${ext}`
  const { storageKey } = await uploadJobFile({ path, buffer, mimeType: file.type || "image/jpeg" })

  if (job.hero_image_storage_key && job.hero_image_storage_key !== storageKey) {
    await deleteJobFile(job.hero_image_storage_key).catch((err) => console.error("[hero-image] cleanup failed", err))
  }

  await recruitment.from("jobs").update({ hero_image_storage_key: storageKey }).eq("id", jobId)

  return NextResponse.json({ hero_image_storage_key: storageKey })
}

// DELETE /api/recruitment/jobs/[jobId]/hero-image — remove the hero image.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await requirePermissionOrSuperAdmin(supabase, user.id, "recruitment.jobs.edit"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { jobId } = await params
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recruitment = admin.schema("recruitment") as any

  const { data: job } = await recruitment.from("jobs").select("hero_image_storage_key").eq("id", jobId).single()
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 })

  if (job.hero_image_storage_key) {
    await deleteJobFile(job.hero_image_storage_key).catch((err) => console.error("[hero-image] delete failed", err))
  }
  await recruitment.from("jobs").update({ hero_image_storage_key: null }).eq("id", jobId)

  return NextResponse.json({ ok: true })
}

// GET /api/recruitment/jobs/[jobId]/hero-image — stream the current hero
// image (used as the <img src> from the job detail page's admin UI, since
// the bucket is private).
export async function GET(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { jobId } = await params
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: job } = await (admin.schema("recruitment") as any)
    .from("jobs")
    .select("hero_image_storage_key")
    .eq("id", jobId)
    .single()

  if (!job?.hero_image_storage_key) return NextResponse.json({ error: "No hero image" }, { status: 404 })

  const { buffer, mimeType } = await downloadJobFile(job.hero_image_storage_key)
  return new Response(new Uint8Array(buffer), { headers: { "Content-Type": mimeType, "Cache-Control": "private, max-age=60" } })
}
