import { NextRequest, NextResponse, after } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { ingestCv } from "@/lib/cv-parsing/ingest"
import { z } from "zod"

/**
 * PUBLIC endpoint — no session auth. Receives job applications pushed by a
 * `gform_after_submission_<form_id>` action hook on the WordPress site
 * (posted server-side via wp_remote_post — not the GF Webhooks Add-On, so
 * the payload shape is custom and fixed on the WordPress side). Sends
 * first_name/last_name separately (not a combined full_name) since Gravity
 * Forms' Name field type already splits them into sub-fields, and so does
 * recruitment.candidates.
 *
 * Auth: shared secret in the `x-api-key` header, checked against
 * GRAVITY_FORMS_SECRET (same env var used by /api/public/apply's HMAC path
 * — set the WordPress snippet's $secret to this value).
 *
 * Job matching: `job_reference` is matched against recruitment.jobs
 * (reference_number, falling back to id) — the WP form's hidden job
 * reference field should be populated with the same reference_number shown
 * in the portal's job edit dialog.
 */

const emptyToUndef = (v: unknown) => (v === "" ? undefined : v)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const applicationSchema = z.object({
  job_reference:              z.string().optional(),
  where_did_you_hear:         z.string().optional(),
  first_name:                 z.string().min(1),
  last_name:                  z.string().optional().default(""),
  email:                      z.string().email(),
  phone:                      z.string().optional(),
  linkedin:                   z.string().optional(),
  linkedin_bitly:             z.string().optional(),
  state:                      z.string().optional(),
  permanent_workrights:       z.array(z.string()).optional().default([]),
  availability:                z.string().optional(),
  highest_education:          z.string().optional(),
  year_of_graduation:         z.union([z.string(), z.number()]).optional(),
  work_location_preferences:  z.array(z.string()).optional().default([]),
  work_type_preference:       z.array(z.string()).optional().default([]),
  current_salary:             z.union([z.string(), z.number()]).optional(),
  min_salary_expectation:     z.union([z.string(), z.number()]).optional(),
  aborginal_torres_islander:  z.string().optional(),
  cover_letter_url:           z.preprocess(emptyToUndef, z.string().url().optional()),
  resume_url:                 z.preprocess(emptyToUndef, z.string().url().optional()),
  interested_fields:          z.string().optional(),
  keep_me_in_the_loop:        z.union([z.string(), z.boolean()]).optional(),
  permission_to_store:        z.union([z.string(), z.boolean()]).optional(),
  wp_entry_id:                z.union([z.string(), z.number()]).optional(),
})

export async function POST(req: NextRequest) {
  const secret = process.env.GRAVITY_FORMS_SECRET
  if (secret) {
    if (req.headers.get("x-api-key") !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  } else {
    console.warn("[applications] GRAVITY_FORMS_SECRET not set — skipping x-api-key verification")
  }

  const body = await req.json()
  const parsed = applicationSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid application data", details: parsed.error.flatten() },
      { status: 400 }
    )
  }
  const data = parsed.data

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recruitment = admin.schema("recruitment") as any

  // Resolve job from reference_number or UUID. `id` is uuid-typed — only
  // include the `id.eq.` clause when the reference actually looks like a
  // UUID, otherwise Postgres rejects the whole OR filter with an
  // invalid-input-syntax error (silently, if the error isn't checked) and
  // no job ever matches, even when reference_number matches exactly.
  let jobId: string | null = null
  if (data.job_reference) {
    const ref = data.job_reference
    const filter = UUID_RE.test(ref) ? `reference_number.eq.${ref},id.eq.${ref}` : `reference_number.eq.${ref}`
    const { data: byRef, error: byRefError } = await recruitment
      .from("jobs")
      .select("id, status")
      .or(filter)
      .maybeSingle()
    if (byRefError) console.error("[applications] job lookup failed", byRefError)
    if (byRef) jobId = byRef.id
  }

  const { data: upsertResult, error: upsertError } = await recruitment
    .rpc("upsert_candidate", {
      p_email:          data.email,
      p_phone:          data.phone ?? null,
      p_first_name:     data.first_name,
      p_last_name:      data.last_name,
      p_location_state: data.state ?? null,
      p_source_channel: "company_website",
      p_added_by:       null,
    })

  if (upsertError) {
    return NextResponse.json({ error: "Could not process candidate" }, { status: 500 })
  }

  const candidateId     = upsertResult?.[0]?.candidate_id
  const candidateAction = upsertResult?.[0]?.action

  if (!jobId) {
    return NextResponse.json({
      status: "candidate_only",
      message: "Candidate profile created, but no matching job found for the reference provided.",
      candidate_id: candidateId,
      action: candidateAction,
    }, { status: 200 })
  }

  // Check for duplicate application
  const { data: existing } = await recruitment
    .from("applications")
    .select("id, stage, cv_storage_key, cl_storage_key")
    .eq("job_id", jobId)
    .eq("candidate_id", candidateId)
    .maybeSingle()

  if (existing) {
    // Same candidate + job as before — don't create a second application
    // row, but if the existing one is still missing a CV/CL (e.g. a prior
    // ingestion attempt failed, which is silent by design) and this
    // resubmission provides one, retry the attachment against the existing
    // application instead of silently no-op'ing forever.
    if (data.resume_url && !existing.cv_storage_key) {
      const resumeUrl = data.resume_url
      after(() =>
        ingestCv({ candidateId, applicationId: existing.id, docType: "cv", source: { url: resumeUrl } })
          .catch((err) => console.error("[applications] resume re-ingest failed", err))
      )
    }
    if (data.cover_letter_url && !existing.cl_storage_key) {
      const clUrl = data.cover_letter_url
      after(() =>
        ingestCv({ candidateId, applicationId: existing.id, docType: "cl", source: { url: clUrl } })
          .catch((err) => console.error("[applications] cover letter re-ingest failed", err))
      )
    }

    return NextResponse.json({
      status: "duplicate_skipped",
      application_id: existing.id,
      candidate_id: candidateId,
    }, { status: 200 })
  }

  const { data: app, error: appError } = await recruitment
    .from("applications")
    .insert({
      job_id:         jobId,
      candidate_id:   candidateId,
      source_channel: "company_website",
      source_metadata: {
        origin:                     "wordpress_gravity_forms",
        wp_entry_id:                data.wp_entry_id ?? null,
        where_did_you_hear:         data.where_did_you_hear ?? null,
        linkedin:                   data.linkedin ?? null,
        linkedin_bitly:             data.linkedin_bitly ?? null,
        permanent_workrights:       data.permanent_workrights,
        availability:               data.availability ?? null,
        highest_education:          data.highest_education ?? null,
        year_of_graduation:         data.year_of_graduation ?? null,
        work_location_preferences:  data.work_location_preferences,
        work_type_preference:       data.work_type_preference,
        current_salary:             data.current_salary ?? null,
        min_salary_expectation:     data.min_salary_expectation ?? null,
        aborginal_torres_islander:  data.aborginal_torres_islander ?? null,
        interested_fields:          data.interested_fields ?? null,
        keep_me_in_the_loop:        data.keep_me_in_the_loop ?? null,
        permission_to_store:        data.permission_to_store ?? null,
        cover_letter_url:           data.cover_letter_url ?? null,
        resume_url:                 data.resume_url ?? null,
      },
      stage: "applied",
    })
    .select("id, job_id, candidate_id, stage, source_channel, created_at")
    .single()

  if (appError) {
    return NextResponse.json({ error: "Could not create application" }, { status: 500 })
  }

  if (data.resume_url) {
    const resumeUrl = data.resume_url
    after(() =>
      ingestCv({ candidateId, applicationId: app.id, docType: "cv", source: { url: resumeUrl } })
        .catch((err) => console.error("[applications] resume ingest failed", err))
    )
  }
  if (data.cover_letter_url) {
    const clUrl = data.cover_letter_url
    after(() =>
      ingestCv({ candidateId, applicationId: app.id, docType: "cl", source: { url: clUrl } })
        .catch((err) => console.error("[applications] cover letter ingest failed", err))
    )
  }

  // Initial stage history
  await recruitment
    .from("application_stage_history")
    .insert({ application_id: app.id, from_stage: null, to_stage: "applied", changed_by: null })

  return NextResponse.json({
    status: "created",
    application_id: app.id,
    candidate_id: candidateId,
    candidate_action: candidateAction,
  }, { status: 201 })
}
