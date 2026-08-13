import { NextRequest, NextResponse, after } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { ingestCvFile, parseCvAfterIngest } from "@/lib/cv-parsing/ingest"
import { isLinkedinProfileUrl } from "@/lib/recruitment/linkedin-url"
import { z } from "zod"

// CV parsing (in the after() callback below) can take well over a minute for
// a dense resume — see src/lib/cv-parsing/gemini.ts. after() runs within the
// route's own duration budget, so the default was killing it mid-parse.
export const maxDuration = 180

/**
 * PUBLIC endpoint — no session auth. Receives 3 form types pushed by
 * `gform_entry_post_save_<form_id>` action hooks on the WordPress site
 * (posted server-side via wp_remote_post — not the GF Webhooks Add-On, so
 * the payload shape is custom and fixed on the WordPress side), disambiguated
 * by the `submission_type` field:
 *   - "job_application"           (Form 20) — candidate applying to a job
 *   - "talent_pool_registration"  (Form 21) — general registration, no job
 *   - "application_detail_update" (Form 26) — candidate self-service profile update
 *
 * Auth: shared secret in the `x-api-key` header, checked against
 * GRAVITY_FORMS_SECRET (same env var used by /api/public/apply's HMAC path
 * — set the WordPress snippet's $secret to this value).
 *
 * Candidate matching: `upsert_candidate` matches on email, then phone, then
 * secondary_email (see the RPC). Job Application submissions use the RPC's
 * default fill-blanks-only merge (an existing candidate's data is never
 * clobbered by a self-reported job application). Talent Pool Registration and
 * Application Detail Update are self-service — the candidate is explicitly
 * asserting their own current details — so those two pass p_overwrite=true:
 * a non-blank submitted value replaces the existing one, but a blank/omitted
 * field never wipes existing data (see the migration for the exact COALESCE
 * semantics).
 *
 * Job matching: `job_reference` (Job Application only) is matched against
 * recruitment.jobs (reference_number, falling back to id) — the WP form's
 * hidden job reference field should be populated with the same reference_number
 * shown in the portal's job edit dialog. If it doesn't match (or the form has
 * no job at all, as with the other two submission types), no application row
 * is created — just the candidate profile.
 *
 * CV/cover letter delivery: only `resume_base64`/`cover_letter_base64` is
 * treated as a file source (WordPress reads the file off its own local
 * filesystem via GFFormsModel::get_physical_file_path() and sends the bytes
 * directly). `resume_url`/`cover_letter_url` are still accepted and stored
 * in source_metadata for reference, but deliberately never fetched — in
 * practice every URL-delivery attempt has hit either Gravity Forms' own
 * block on direct external access to its uploads directory, or a 404
 * (investigated 2026-08-13: candidates Chen Gu/John Ghazvini/Renee
 * Sokias/Srinivasan Sundararaj all got `file not found locally` on the
 * base64 side too, meaning the file wasn't resolvable by any path — a
 * WordPress/GF-side issue, not something fetching the URL would fix).
 * Base64 is the only delivery path with a track record of working. Only Job
 * Application and Talent Pool Registration collect files; Application
 * Detail Update never sends one.
 *
 * ingestCvFile is awaited here — i.e. it happens before this handler
 * responds to WordPress's blocking wp_remote_post call — rather than
 * deferred, since the base64 buffer is only valid for this request's
 * lifetime anyway. Only the slow CV parsing step (parseCvAfterIngest) is
 * deferred via after().
 */

// PHP's json_encode(null) sends a JSON `null`, which z.string().optional()
// rejects (it only accepts undefined/absent) — treat null the same as "".
const emptyToUndef = (v: unknown) => (v === "" || v === null ? undefined : v)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const optionalString = () => z.preprocess(emptyToUndef, z.string().optional())
const optionalStringOrNumber = () => z.preprocess(emptyToUndef, z.union([z.string(), z.number()]).optional())

// Fields common to all 3 WordPress forms.
const baseFields = {
  first_name:                 z.string().min(1),
  last_name:                  z.string().optional().default(""),
  email:                      z.string().email(),
  phone:                      optionalString(),
  linkedin:                   optionalString(),
  state:                      optionalString(),
  permanent_workrights:       z.array(z.string()).optional().default([]),
  availability:               optionalString(),
  highest_education:          optionalString(),
  year_of_graduation:         optionalStringOrNumber(),
  work_type_preference:       z.array(z.string()).optional().default([]),
  current_salary:             optionalStringOrNumber(),
  min_salary_expectation:     optionalStringOrNumber(),
  interested_fields:          optionalString(),
  aborginal_torres_islander:  optionalString(),
  keep_me_in_the_loop:        z.preprocess(emptyToUndef, z.union([z.string(), z.boolean()]).optional()),
  permission_to_store:        z.preprocess(emptyToUndef, z.union([z.string(), z.boolean()]).optional()),
  wp_entry_id:                z.preprocess(emptyToUndef, z.union([z.string(), z.number()]).optional()),
}

const fileFields = {
  cover_letter_url:           z.preprocess(emptyToUndef, z.string().url().optional()),
  cover_letter_base64:        optionalString(),
  cover_letter_filename:      optionalString(),
  cover_letter_mimetype:      optionalString(),
  resume_url:                 z.preprocess(emptyToUndef, z.string().url().optional()),
  resume_base64:              optionalString(),
  resume_filename:            optionalString(),
  resume_mimetype:            optionalString(),
}

const jobApplicationSchema = z.object({
  ...baseFields,
  ...fileFields,
  job_reference:               optionalString(),
  where_did_you_hear:          optionalString(),
  linkedin_bitly:               optionalString(),
  work_location_preferences:   z.array(z.string()).optional().default([]),
})

const talentPoolSchema = z.object({
  ...baseFields,
  ...fileFields,
  work_location_preferences:   z.array(z.string()).optional().default([]),
})

const detailUpdateSchema = z.object({
  ...baseFields,
})

type JobApplicationData = z.infer<typeof jobApplicationSchema>
type TalentPoolData = z.infer<typeof talentPoolSchema>
type DetailUpdateData = z.infer<typeof detailUpdateSchema>

type FileSource = { buffer: Buffer; mimeType: string; originalName: string }

// URL delivery (resume_url/cover_letter_url) is intentionally not treated as
// a file source here — it has never once produced a working download in
// practice, only ever a Gravity-Forms-blocked or 404'd link, while base64
// (WordPress reading the file off its own local disk) is the reliable path.
// The URL fields are still accepted and logged in source_metadata for
// reference, just never fetched. Seek's webhook (src/app/api/webhooks/seek)
// still uses `ingestCvFile` with a `{ url }` source — only this route drops it.
function resolveFileSource(
  base64: string | undefined,
  filename: string | undefined,
  mimetype: string | undefined
): FileSource | null {
  if (!base64) return null
  return {
    buffer: Buffer.from(base64, "base64"),
    mimeType: mimetype || "application/octet-stream",
    originalName: filename || "file",
  }
}

// The intake fields collected by these forms have no dedicated candidate
// columns — they're stashed as one JSON blob (self_reported_metadata).
function buildSelfReportedMetadata(
  data: {
    where_did_you_hear?: string
    permanent_workrights: string[]
    availability?: string
    highest_education?: string
    year_of_graduation?: string | number
    work_location_preferences?: string[]
    work_type_preference: string[]
    interested_fields?: string
    aborginal_torres_islander?: string
    keep_me_in_the_loop?: string | boolean
    permission_to_store?: string | boolean
    wp_entry_id?: string | number
    resume_url?: string
    resume_base64?: string
    cover_letter_url?: string
    cover_letter_base64?: string
  },
  submissionType: string
) {
  return {
    updated_via:                submissionType,
    wp_entry_id:                data.wp_entry_id ?? null,
    where_did_you_hear:         data.where_did_you_hear ?? null,
    permanent_workrights:       data.permanent_workrights,
    availability:               data.availability ?? null,
    highest_education:          data.highest_education ?? null,
    year_of_graduation:         data.year_of_graduation ?? null,
    work_location_preferences:  data.work_location_preferences ?? null,
    work_type_preference:       data.work_type_preference,
    interested_fields:          data.interested_fields ?? null,
    aborginal_torres_islander:  data.aborginal_torres_islander ?? null,
    keep_me_in_the_loop:        data.keep_me_in_the_loop ?? null,
    permission_to_store:        data.permission_to_store ?? null,
    // Kept here (not just on the application row) because this path also
    // runs when no job matches — the only place that submission's CV/CL
    // delivery info survives, so a failed ingest is still diagnosable and
    // has a recoverable link, same as the matched-job case.
    resume_url:                 data.resume_url ?? null,
    resume_delivery:            data.resume_base64 ? "base64" : data.resume_url ? "url" : null,
    cover_letter_url:           data.cover_letter_url ?? null,
    cover_letter_delivery:      data.cover_letter_base64 ? "base64" : data.cover_letter_url ? "url" : null,
  }
}

async function upsertCandidateFromForm(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  recruitment: any,
  data: {
    email: string
    phone?: string
    first_name: string
    last_name: string
    state?: string
    linkedin?: string
    linkedin_bitly?: string
    current_salary?: string | number
    min_salary_expectation?: string | number
  },
  opts: { overwrite: boolean; selfReportedMetadata: Record<string, unknown> }
) {
  const rawLinkedin = data.linkedin || data.linkedin_bitly
  const normalizedRaw = rawLinkedin ? (/^https?:\/\//i.test(rawLinkedin) ? rawLinkedin : `https://${rawLinkedin}`) : null
  const linkedinUrl = normalizedRaw && isLinkedinProfileUrl(normalizedRaw) ? normalizedRaw : null

  return recruitment.rpc("upsert_candidate", {
    p_email:                  data.email,
    p_phone:                  data.phone ?? null,
    p_first_name:             data.first_name,
    p_last_name:              data.last_name,
    p_location_state:         data.state ?? null,
    p_source_channel:         "company_website",
    p_added_by:               null,
    p_linkedin_url:           linkedinUrl,
    p_current_salary:         data.current_salary != null && data.current_salary !== "" ? Number(data.current_salary) : null,
    p_base_salary_expected:   data.min_salary_expectation != null ? String(data.min_salary_expectation) : null,
    p_overwrite:              opts.overwrite,
    p_self_reported_metadata: opts.selfReportedMetadata,
  })
}

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
  const submissionType = typeof body.submission_type === "string" ? body.submission_type : "job_application"

  switch (submissionType) {
    case "job_application":
      return handleJobApplication(body)
    case "talent_pool_registration":
      return handleTalentPoolRegistration(body)
    case "application_detail_update":
      return handleApplicationDetailUpdate(body)
    default:
      return NextResponse.json({ error: `Unknown submission_type: ${submissionType}` }, { status: 400 })
  }
}

async function handleJobApplication(body: unknown) {
  const parsed = jobApplicationSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid application data", details: parsed.error.flatten() }, { status: 400 })
  }
  const data: JobApplicationData = parsed.data

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

  const { data: upsertResult, error: upsertError } = await upsertCandidateFromForm(recruitment, data, {
    overwrite: false,
    selfReportedMetadata: buildSelfReportedMetadata(data, "job_application"),
  })

  if (upsertError) {
    return NextResponse.json({ error: "Could not process candidate" }, { status: 500 })
  }

  const candidateId     = upsertResult?.[0]?.candidate_id
  const candidateAction = upsertResult?.[0]?.action

  const resumeSource = resolveFileSource(data.resume_base64, data.resume_filename, data.resume_mimetype)
  const clSource = resolveFileSource(data.cover_letter_base64, data.cover_letter_filename, data.cover_letter_mimetype)

  if (!jobId) {
    // No matching job — still land the CV/cover letter against the
    // candidate profile (unscoped to any application) rather than dropping
    // it, since the candidate record is created either way. Download is
    // awaited (not deferred) — see ingestCvFile's doc comment for why.
    if (resumeSource) {
      const resumeFile = await ingestCvFile({ candidateId, docType: "cv", source: resumeSource })
      if (resumeFile) after(() => parseCvAfterIngest(resumeFile))
    }
    if (clSource) {
      await ingestCvFile({ candidateId, docType: "cl", source: clSource })
    }

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
    if (!existing.cv_storage_key && resumeSource) {
      const resumeFile = await ingestCvFile({ candidateId, applicationId: existing.id, docType: "cv", source: resumeSource })
      if (resumeFile) after(() => parseCvAfterIngest(resumeFile))
    }
    if (!existing.cl_storage_key && clSource) {
      await ingestCvFile({ candidateId, applicationId: existing.id, docType: "cl", source: clSource })
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
        resume_delivery:            data.resume_base64 ? "base64" : data.resume_url ? "url" : null,
        cover_letter_delivery:      data.cover_letter_base64 ? "base64" : data.cover_letter_url ? "url" : null,
      },
      stage: "applied",
    })
    .select("id, job_id, candidate_id, stage, source_channel, created_at")
    .single()

  if (appError) {
    return NextResponse.json({ error: "Could not create application" }, { status: 500 })
  }

  if (resumeSource) {
    const resumeFile = await ingestCvFile({ candidateId, applicationId: app.id, docType: "cv", source: resumeSource })
    if (resumeFile) after(() => parseCvAfterIngest(resumeFile))
  }
  if (clSource) {
    await ingestCvFile({ candidateId, applicationId: app.id, docType: "cl", source: clSource })
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

async function handleTalentPoolRegistration(body: unknown) {
  const parsed = talentPoolSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid registration data", details: parsed.error.flatten() }, { status: 400 })
  }
  const data: TalentPoolData = parsed.data

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recruitment = admin.schema("recruitment") as any

  // Self-service — the candidate is asserting their own current details, so
  // a match gets overwritten (never blanked) rather than just fill-blanks.
  const { data: upsertResult, error: upsertError } = await upsertCandidateFromForm(recruitment, data, {
    overwrite: true,
    selfReportedMetadata: buildSelfReportedMetadata(data, "talent_pool_registration"),
  })

  if (upsertError) {
    return NextResponse.json({ error: "Could not process candidate" }, { status: 500 })
  }

  const candidateId     = upsertResult?.[0]?.candidate_id
  const candidateAction = upsertResult?.[0]?.action

  // No job/application involved — attach CV/cover letter straight to the
  // candidate profile.
  const resumeSource = resolveFileSource(data.resume_base64, data.resume_filename, data.resume_mimetype)
  if (resumeSource) {
    const resumeFile = await ingestCvFile({ candidateId, docType: "cv", source: resumeSource })
    if (resumeFile) after(() => parseCvAfterIngest(resumeFile))
  }
  const clSource = resolveFileSource(data.cover_letter_base64, data.cover_letter_filename, data.cover_letter_mimetype)
  if (clSource) {
    await ingestCvFile({ candidateId, docType: "cl", source: clSource })
  }

  return NextResponse.json({
    status: candidateAction === "overwritten" ? "candidate_updated" : "candidate_registered",
    candidate_id: candidateId,
    action: candidateAction,
  }, { status: 200 })
}

async function handleApplicationDetailUpdate(body: unknown) {
  const parsed = detailUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid update data", details: parsed.error.flatten() }, { status: 400 })
  }
  const data: DetailUpdateData = parsed.data

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recruitment = admin.schema("recruitment") as any

  // Self-service — same overwrite-on-match semantics as talent pool
  // registration. This form never sends a CV/cover letter.
  const { data: upsertResult, error: upsertError } = await upsertCandidateFromForm(recruitment, data, {
    overwrite: true,
    selfReportedMetadata: buildSelfReportedMetadata(data, "application_detail_update"),
  })

  if (upsertError) {
    return NextResponse.json({ error: "Could not process candidate" }, { status: 500 })
  }

  const candidateId     = upsertResult?.[0]?.candidate_id
  const candidateAction = upsertResult?.[0]?.action

  return NextResponse.json({
    status: candidateAction === "overwritten" ? "candidate_updated" : "candidate_registered",
    candidate_id: candidateId,
    action: candidateAction,
  }, { status: 200 })
}
