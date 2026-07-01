import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { z } from "zod"

/**
 * PUBLIC endpoint — no authentication required.
 * Receives job applications from:
 *   1. Gravity Forms (WordPress) webhook
 *   2. Company website apply forms
 *
 * Gravity Forms configuration:
 *   - Install Gravity Forms Webhooks Add-On
 *   - Create a new Webhook notification on the form submit event
 *   - Request URL: https://portal.csexecutivegroup.com.au/api/public/apply
 *   - Request Method: POST
 *   - Request Format: JSON
 *   - Map your form fields to these keys:
 *       first_name      → First Name field
 *       last_name       → Last Name field
 *       email           → Email field
 *       phone           → Phone field
 *       current_title   → Current Job Title field
 *       current_employer→ Current Employer field
 *       job_reference   → Hidden field (pre-populated from URL param or job post)
 *       source_channel  → Hidden field (set to "company_website")
 *   - Optional: cv_url (link to uploaded CV if using GF file upload)
 *
 * Security: Sign requests with the shared secret in GRAVITY_FORMS_SECRET env var
 *   by adding a custom header "x-gf-signature: <sha256-hmac of body>"
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-gf-signature",
}

const applySchema = z.object({
  first_name:        z.string().min(1),
  last_name:         z.string().min(1),
  email:             z.string().email(),
  phone:             z.string().optional(),
  current_title:     z.string().optional(),
  current_employer:  z.string().optional(),
  location_city:     z.string().optional(),
  location_state:    z.string().optional(),
  skills:            z.union([z.string(), z.array(z.string())]).optional(),
  job_reference:     z.string().optional(),   // reference_number or job UUID
  source_channel:    z.enum(["company_website", "seek_inbound", "linkedin", "database_internal", "seek_talent"]).default("company_website"),
  cv_url:            z.string().url().optional(),   // external URL to CV (Gravity Forms upload link)
  notes:             z.string().optional(),
  // Gravity Forms raw fields (alternate mapping — GF sends field IDs as keys)
  "1":               z.string().optional(),  // fallback: GF field 1
  "2":               z.string().optional(),  // fallback: GF field 2
  "3":               z.string().optional(),  // fallback: GF field 3
})

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(req: NextRequest) {
  // Optional signature verification (when GRAVITY_FORMS_SECRET is set)
  const gfSecret = process.env.GRAVITY_FORMS_SECRET
  if (gfSecret) {
    const sig = req.headers.get("x-gf-signature")
    if (sig) {
      const { createHmac } = await import("crypto")
      const rawBody = await req.text()
      const expected = createHmac("sha256", gfSecret).update(rawBody).digest("hex")
      if (sig !== expected) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 401, headers: CORS_HEADERS })
      }
      // Re-parse since we consumed the stream
      const body = JSON.parse(rawBody)
      return await processApplication(req, body)
    }
  }

  const body = await req.json()
  return processApplication(req, body)
}

async function processApplication(req: NextRequest, rawBody: Record<string, unknown>) {
  // Normalize Gravity Forms raw field mapping if named fields are missing
  const normalized = {
    first_name:       rawBody.first_name ?? rawBody["1"],
    last_name:        rawBody.last_name  ?? rawBody["2"],
    email:            rawBody.email      ?? rawBody["3"],
    phone:            rawBody.phone      ?? rawBody["4"],
    current_title:    rawBody.current_title    ?? rawBody["5"],
    current_employer: rawBody.current_employer ?? rawBody["6"],
    job_reference:    rawBody.job_reference    ?? rawBody["job_ref"] ?? req.nextUrl.searchParams.get("ref"),
    source_channel:   rawBody.source_channel ?? "company_website",
    cv_url:           rawBody.cv_url,
    notes:            rawBody.notes,
    skills:           rawBody.skills,
    location_city:    rawBody.location_city,
    location_state:   rawBody.location_state,
  }

  const parsed = applySchema.safeParse(normalized)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid application data", details: parsed.error.flatten() },
      { status: 400, headers: CORS_HEADERS }
    )
  }

  const admin = createAdminClient()

  // Resolve job from reference_number or UUID
  let jobId: string | null = null
  if (parsed.data.job_reference) {
    const ref = parsed.data.job_reference
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: byRef } = await (admin.schema("recruitment") as any)
      .from("jobs")
      .select("id, status")
      .or(`reference_number.eq.${ref},id.eq.${ref}`)
      .maybeSingle()
    if (byRef) jobId = byRef.id
  }

  // Upsert candidate
  const skillsArray = Array.isArray(parsed.data.skills)
    ? parsed.data.skills
    : parsed.data.skills ? [parsed.data.skills] : []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: upsertResult, error: upsertError } = await (admin.schema("recruitment") as any)
    .rpc("upsert_candidate", {
      p_email:           parsed.data.email,
      p_phone:           parsed.data.phone ?? null,
      p_first_name:      parsed.data.first_name,
      p_last_name:       parsed.data.last_name,
      p_current_title:   parsed.data.current_title ?? null,
      p_current_employer:parsed.data.current_employer ?? null,
      p_location_city:   parsed.data.location_city ?? null,
      p_location_state:  parsed.data.location_state ?? null,
      p_skills_tags:     skillsArray.length ? skillsArray : null,
      p_source_channel:  parsed.data.source_channel,
      p_added_by:        null,
    })

  if (upsertError) {
    return NextResponse.json({ error: "Could not process candidate" }, { status: 500, headers: CORS_HEADERS })
  }

  const candidateId  = upsertResult?.[0]?.candidate_id
  const candidateAction = upsertResult?.[0]?.action

  if (!jobId) {
    // Candidate created/merged but no job matched
    return NextResponse.json({
      status: "candidate_only",
      message: "Candidate profile created, but no matching job found for the reference provided.",
      candidate_id: candidateId,
      action: candidateAction,
    }, { status: 200, headers: CORS_HEADERS })
  }

  // Check for duplicate application
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (admin.schema("recruitment") as any)
    .from("applications")
    .select("id, stage")
    .eq("job_id", jobId)
    .eq("candidate_id", candidateId)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({
      status: "duplicate_skipped",
      application_id: existing.id,
      candidate_id: candidateId,
    }, { status: 200, headers: CORS_HEADERS })
  }

  // Create application
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: app, error: appError } = await (admin.schema("recruitment") as any)
    .from("applications")
    .insert({
      job_id:         jobId,
      candidate_id:   candidateId,
      source_channel: parsed.data.source_channel,
      source_metadata: { cv_url: parsed.data.cv_url, origin: req.headers.get("origin") ?? "unknown" },
      notes:           parsed.data.notes ?? null,
      stage:           "applied",
    })
    .select("id, job_id, candidate_id, stage, source_channel, created_at")
    .single()

  if (appError) {
    return NextResponse.json({ error: "Could not create application" }, { status: 500, headers: CORS_HEADERS })
  }

  // Insert initial stage history
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin.schema("recruitment") as any)
    .from("application_stage_history")
    .insert({
      application_id: app.id,
      from_stage: null,
      to_stage: "applied",
      changed_by: null,
    })

  return NextResponse.json({
    status: "created",
    application_id: app.id,
    candidate_id: candidateId,
    candidate_action: candidateAction,
  }, { status: 201, headers: CORS_HEADERS })
}
