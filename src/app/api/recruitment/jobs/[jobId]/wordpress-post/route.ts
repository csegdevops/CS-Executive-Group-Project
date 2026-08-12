import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requirePermissionOrSuperAdmin } from "@/lib/auth-helpers"
import { getJobFileBuffer } from "@/lib/storage/job-storage"

/**
 * WordPress outbound job-posting integration.
 *
 * To activate: create a WordPress user with publish_posts capability and an
 * Application Password (Users → Profile → Application Passwords), then set
 * WORDPRESS_URL, WORDPRESS_API_USER, WORDPRESS_APP_PASSWORD in environment.
 *
 * Authenticates via HTTP Basic Auth using the Application Password, per the
 * WP REST API's standard auth mechanism (no OAuth flow, unlike Seek).
 *
 * Standard jobs post to WORDPRESS_JOB_POST_TYPE (default "posts"); jobs
 * flagged is_executive_search post to WORDPRESS_EXEC_POST_TYPE instead — a
 * custom post type expected to exist on the WordPress side already (this
 * route does not create it). Both default post types must accept the same
 * core REST fields (title, content, status, featured_media); any custom
 * fields (e.g. narrative copy, confidentiality) are sent under `meta` and
 * require matching `register_post_meta` calls on the WP side to persist —
 * document this contract for whoever builds the WP template.
 */

const WORDPRESS_CONFIGURED = !!(
  process.env.WORDPRESS_URL &&
  process.env.WORDPRESS_API_USER &&
  process.env.WORDPRESS_APP_PASSWORD
)

function wpAuthHeader(): string {
  const token = Buffer.from(`${process.env.WORDPRESS_API_USER}:${process.env.WORDPRESS_APP_PASSWORD}`).toString("base64")
  return `Basic ${token}`
}

function postTypeFor(isExecutiveSearch: boolean): string {
  return isExecutiveSearch
    ? process.env.WORDPRESS_EXEC_POST_TYPE || "executive_search"
    : process.env.WORDPRESS_JOB_POST_TYPE || "posts"
}

async function uploadHeroImageToWordPress(storageKey: string): Promise<number | null> {
  try {
    const { buffer, mimeType } = await getJobFileBuffer(storageKey)
    const filename = storageKey.split("/").pop() || "hero.jpg"
    const res = await fetch(`${process.env.WORDPRESS_URL}/wp-json/wp/v2/media`, {
      method: "POST",
      headers: {
        Authorization: wpAuthHeader(),
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
      body: new Uint8Array(buffer),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.id ?? null
  } catch (err) {
    console.error("[wordpress-post] hero image upload failed", err)
    return null
  }
}

// POST /api/recruitment/jobs/[jobId]/wordpress-post — publish to WordPress
export async function POST(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await requirePermissionOrSuperAdmin(supabase, user.id, "recruitment.jobs.edit"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { jobId } = await params
  const admin = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: job } = await (admin.schema("recruitment") as any)
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .single()
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 })

  if (!WORDPRESS_CONFIGURED) {
    return NextResponse.json({
      status: "not_configured",
      message: "WordPress credentials not yet configured.",
      guidance: {
        step1: "In WP admin: Users → your profile → Application Passwords → create one for this integration",
        step2: "Set environment variables: WORDPRESS_URL, WORDPRESS_API_USER, WORDPRESS_APP_PASSWORD",
        step3: "If posting executive-search roles, also create the executive_search custom post type in WP (or set WORDPRESS_EXEC_POST_TYPE to its slug) with meta fields registered for narrative_copy/confidential_mode",
        required_env: ["WORDPRESS_URL", "WORDPRESS_API_USER", "WORDPRESS_APP_PASSWORD"],
      },
    }, { status: 503 })
  }

  const isExecutiveSearch = !!job.is_executive_search
  const confidential = isExecutiveSearch && !!job.confidential_mode

  const { data: company } = await admin.from("companies").select("name").eq("id", job.company_id).single()

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://portal.csexecutivegroup.com.au"
  const applyUrl = `${baseUrl}/api/public/apply?ref=${job.reference_number ?? jobId}`

  let featuredMedia: number | null = null
  if (isExecutiveSearch && job.hero_image_storage_key) {
    featuredMedia = await uploadHeroImageToWordPress(job.hero_image_storage_key)
  }

  const contentParts = [
    isExecutiveSearch && job.narrative_copy ? job.narrative_copy : job.description ?? "",
    job.requirements ? `<h3>Requirements</h3>${job.requirements}` : "",
  ].filter(Boolean)

  const postType = postTypeFor(isExecutiveSearch)
  const payload: Record<string, unknown> = {
    title: job.title,
    content: contentParts.join("\n\n"),
    status: "publish",
    ...(featuredMedia ? { featured_media: featuredMedia } : {}),
    meta: {
      job_reference: job.reference_number ?? jobId,
      apply_url: applyUrl,
      company_name: confidential ? "Confidential" : company?.name ?? "CS Executive Group",
      location: job.location ?? "",
      employment_type: job.employment_type ?? "",
      salary_min: job.salary_min ?? "",
      salary_max: job.salary_max ?? "",
      ...(isExecutiveSearch ? { confidential_mode: confidential } : {}),
    },
  }

  const isUpdate = !!job.wp_post_id
  const wpRes = await fetch(
    `${process.env.WORDPRESS_URL}/wp-json/wp/v2/${postType}${isUpdate ? `/${job.wp_post_id}` : ""}`,
    {
      method: "POST",
      headers: {
        Authorization: wpAuthHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  )

  if (!wpRes.ok) {
    const err = await wpRes.text()
    return NextResponse.json({ error: `WordPress API error: ${err}` }, { status: 502 })
  }

  const wpData = await wpRes.json()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin.schema("recruitment") as any)
    .from("jobs")
    .update({ status: "posted", wp_post_id: String(wpData.id), wp_permalink: wpData.link ?? null })
    .eq("id", jobId)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin.schema("recruitment") as any)
    .from("job_events")
    .insert({
      job_id: jobId,
      event_type: "posted",
      previous_status: job.status,
      new_status: "posted",
      notes: isExecutiveSearch
        ? `Posted to WordPress executive-search microsite (post ID: ${wpData.id})`
        : `Posted to WordPress (post ID: ${wpData.id})`,
      performed_by: user.id,
    })

  return NextResponse.json({
    status: "posted",
    wp_post_id: wpData.id,
    wp_permalink: wpData.link ?? null,
  })
}

// DELETE /api/recruitment/jobs/[jobId]/wordpress-post — withdraw from WordPress
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await requirePermissionOrSuperAdmin(supabase, user.id, "recruitment.jobs.edit"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (!WORDPRESS_CONFIGURED) {
    return NextResponse.json({ status: "not_configured" }, { status: 503 })
  }

  const { jobId } = await params
  const admin = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: job } = await (admin.schema("recruitment") as any)
    .from("jobs")
    .select("wp_post_id, status, is_executive_search")
    .eq("id", jobId)
    .single()
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 })

  if (job.wp_post_id) {
    const postType = postTypeFor(!!job.is_executive_search)
    await fetch(`${process.env.WORDPRESS_URL}/wp-json/wp/v2/${postType}/${job.wp_post_id}`, {
      method: "DELETE",
      headers: { Authorization: wpAuthHeader() },
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin.schema("recruitment") as any)
    .from("jobs")
    .update({ status: "closed", wp_post_id: null, wp_permalink: null })
    .eq("id", jobId)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin.schema("recruitment") as any)
    .from("job_events")
    .insert({
      job_id: jobId,
      event_type: "closed",
      previous_status: job.status,
      new_status: "closed",
      notes: job.wp_post_id ? `Withdrawn from WordPress (post ID: ${job.wp_post_id})` : "Withdrawn from WordPress",
      performed_by: user.id,
    })

  return NextResponse.json({ status: "withdrawn" })
}
