import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * Seek Employer API integration stub.
 *
 * To activate: apply for Seek partner credentials at https://developer.seek.com.au
 * then set SEEK_CLIENT_ID, SEEK_CLIENT_SECRET, SEEK_ADVERTISER_ID in environment.
 *
 * Seek uses OAuth 2.0 client_credentials flow. Each job post returns a seek_ad_id
 * which should be stored on the job record (add seek_ad_id column via migration).
 *
 * Seek Job Posting API ref: https://developer.seek.com.au/use-cases/job-posting
 */

const SEEK_CONFIGURED = !!(
  process.env.SEEK_CLIENT_ID &&
  process.env.SEEK_CLIENT_SECRET &&
  process.env.SEEK_ADVERTISER_ID
)

async function getSeekToken(): Promise<string | null> {
  if (!SEEK_CONFIGURED) return null
  const res = await fetch("https://auth.seek.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.SEEK_CLIENT_ID,
      client_secret: process.env.SEEK_CLIENT_SECRET,
      audience: "https://api.seek.com.au",
      grant_type: "client_credentials",
    }),
  })
  if (!res.ok) return null
  const { access_token } = await res.json()
  return access_token as string
}

// POST /api/recruitment/jobs/[jobId]/seek-post — publish to Seek
export async function POST(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { jobId } = await params
  const admin = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: job } = await (admin.schema("recruitment") as any)
    .from("jobs")
    .select("*, company_id")
    .eq("id", jobId)
    .single()
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 })

  if (!SEEK_CONFIGURED) {
    // Return guidance on what to do next
    return NextResponse.json({
      status: "not_configured",
      message: "Seek partner credentials not yet configured.",
      guidance: {
        step1: "Apply at https://developer.seek.com.au to become a Seek Employer API Partner",
        step2: "Once approved, set environment variables: SEEK_CLIENT_ID, SEEK_CLIENT_SECRET, SEEK_ADVERTISER_ID",
        step3: "Seek will provide a SEEK_WEBHOOK_SECRET for the application inbound webhook",
        required_env: ["SEEK_CLIENT_ID", "SEEK_CLIENT_SECRET", "SEEK_ADVERTISER_ID", "SEEK_WEBHOOK_SECRET"],
        seek_docs: "https://developer.seek.com.au/use-cases/job-posting",
      },
    }, { status: 503 })
  }

  const token = await getSeekToken()
  if (!token) return NextResponse.json({ error: "Could not obtain Seek token" }, { status: 502 })

  const { data: company } = await admin.from("companies").select("name").eq("id", job.company_id).single()

  // Map portal job to Seek Job Posting API payload
  const seekPayload = {
    advertiserId: process.env.SEEK_ADVERTISER_ID,
    jobTitle: job.title,
    jobSummary: job.description ?? "",
    advertisementDetails: job.requirements ?? "",
    workType: job.employment_type === "permanent" ? "FullTime" : job.employment_type === "contract" ? "ContractTemp" : "Casual",
    salary: job.salary_min ? {
      minimum: job.salary_min,
      maximum: job.salary_max ?? job.salary_min,
      currency: job.salary_currency ?? "AUD",
      type: "Annual",
    } : undefined,
    location: job.location ?? "Australia",
    jobReference: job.reference_number ?? jobId,
    applicationEmail: `recruitment+${job.reference_number ?? jobId}@csexecutivegroup.com.au`,
    hirerJobReference: jobId,
  }

  const seekRes = await fetch("https://api.seek.com.au/ads", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(seekPayload),
  })

  if (!seekRes.ok) {
    const err = await seekRes.text()
    return NextResponse.json({ error: `Seek API error: ${err}` }, { status: 502 })
  }

  const seekData = await seekRes.json()

  const seekAdId = seekData.advertisementId as string | undefined

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin.schema("recruitment") as any)
    .from("jobs")
    .update({ status: "posted", seek_ad_id: seekAdId ?? null })
    .eq("id", jobId)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin.schema("recruitment") as any)
    .from("job_events")
    .insert({
      job_id: jobId,
      event_type: "posted",
      previous_status: job.status,
      new_status: "posted",
      notes: seekAdId ? `Posted to Seek (ad ID: ${seekAdId})` : "Posted to Seek",
      performed_by: user.id,
    })

  return NextResponse.json({
    status: "posted",
    seek_ad_id: seekAdId,
    company_name: company?.name,
  })
}

// DELETE /api/recruitment/jobs/[jobId]/seek-post — withdraw from Seek
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!SEEK_CONFIGURED) {
    return NextResponse.json({ status: "not_configured" }, { status: 503 })
  }

  const { jobId } = await params
  const admin = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: job } = await (admin.schema("recruitment") as any)
    .from("jobs").select("seek_ad_id, status").eq("id", jobId).single()
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 })

  if (job.seek_ad_id) {
    const token = await getSeekToken()
    if (token) {
      await fetch(`https://api.seek.com.au/ads/${job.seek_ad_id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin.schema("recruitment") as any)
    .from("jobs")
    .update({ status: "closed", seek_ad_id: null })
    .eq("id", jobId)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin.schema("recruitment") as any)
    .from("job_events")
    .insert({
      job_id: jobId,
      event_type: "closed",
      previous_status: job.status,
      new_status: "closed",
      notes: job.seek_ad_id ? `Withdrawn from Seek (ad ID: ${job.seek_ad_id})` : "Withdrawn from Seek",
      performed_by: user.id,
    })

  return NextResponse.json({ status: "withdrawn" })
}
