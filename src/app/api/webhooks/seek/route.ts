import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createHmac } from "crypto"

/**
 * Seek Application Inbound Webhook
 * ─────────────────────────────────────────────────────────────
 * Seek calls this URL when a candidate applies to one of your jobs on Seek.
 *
 * To activate after receiving Seek Partner credentials:
 * 1. Set SEEK_WEBHOOK_SECRET in environment variables (provided by Seek)
 * 2. Register this URL in the Seek Developer Console:
 *    https://developer.seek.com.au → Webhooks → Add Endpoint
 *    URL: https://portal.csexecutivegroup.com.au/api/webhooks/seek
 *    Events: CandidateApplicationCreated
 *
 * Seek Signature Verification:
 *   Seek sends HMAC-SHA256 in the "seek-signature" header.
 *   We verify it against the raw request body.
 *
 * Seek API reference: https://developer.seek.com.au/use-cases/apply-with-seek
 */

function verifySeekSignature(body: string, signature: string | null, secret: string): boolean {
  if (!signature) return false
  const expected = createHmac("sha256", secret).update(body, "utf8").digest("hex")
  // Constant-time comparison
  try {
    const { timingSafeEqual } = require("crypto")
    return timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"))
  } catch {
    return signature === expected
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get("seek-signature")

  const webhookSecret = process.env.SEEK_WEBHOOK_SECRET
  if (!webhookSecret) {
    // Not yet configured — log and accept (development mode)
    console.warn("[seek-webhook] SEEK_WEBHOOK_SECRET not set — skipping signature verification")
  } else {
    if (!verifySeekSignature(rawBody, signature, webhookSecret)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }
  }

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  // Seek sends an array of events
  const events = Array.isArray(payload.events) ? payload.events : [payload]

  const admin = createAdminClient()
  const results = []

  for (const event of events) {
    const eventType = (event as Record<string, unknown>).type

    if (eventType !== "CandidateApplicationCreated") {
      // Acknowledge but skip other event types
      results.push({ event_id: (event as Record<string, unknown>).id, status: "skipped" })
      continue
    }

    const seek  = event as Record<string, unknown>
    const cand  = seek.candidate as Record<string, unknown>
    const job   = seek.job   as Record<string, unknown>
    const app   = seek.application as Record<string, unknown>
    const name  = cand?.name as Record<string, string> | undefined
    const phones = (cand?.phoneNumbers as Array<{ number: string }>) ?? []

    // Resolve portal job: match seek_ad_id first, then fall back to reference_number
    const seekJobId = job?.id as string | undefined
    const hirerRef  = seek.hirerJobReference as string | undefined
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: portalJob } = await (admin.schema("recruitment") as any)
      .from("jobs")
      .select("id, status")
      .or(
        [
          seekJobId ? `seek_ad_id.eq.${seekJobId}` : null,
          seekJobId ? `reference_number.eq.${seekJobId}` : null,
          hirerRef  ? `reference_number.eq.${hirerRef}` : null,
        ].filter(Boolean).join(",")
      )
      .maybeSingle()

    // Upsert candidate
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: upsertResult, error: upsertError } = await (admin.schema("recruitment") as any)
      .rpc("upsert_candidate", {
        p_email:         cand?.email as string ?? "",
        p_phone:         phones[0]?.number ?? null,
        p_first_name:    name?.first ?? null,
        p_last_name:     name?.last ?? null,
        p_source_channel: "seek_inbound",
        p_added_by:      null,
      })

    if (upsertError) {
      results.push({ event_id: seek.id, status: "error", error: upsertError.message })
      continue
    }

    const candidateId     = upsertResult?.[0]?.candidate_id
    const candidateAction = upsertResult?.[0]?.action

    if (!portalJob || !candidateId) {
      results.push({
        event_id: seek.id,
        status: candidateId ? "candidate_only" : "error",
        candidate_id: candidateId,
        seek_job_id: job?.id,
        note: "No matching portal job found — candidate profile created/merged",
      })
      continue
    }

    // Check duplicate
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (admin.schema("recruitment") as any)
      .from("applications")
      .select("id, stage")
      .eq("job_id", portalJob.id)
      .eq("candidate_id", candidateId)
      .maybeSingle()

    if (existing) {
      results.push({ event_id: seek.id, status: "duplicate_skipped", application_id: existing.id })
      continue
    }

    // Create application
    const cvLink = (app?.cv as Record<string, string>)?.url ?? null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: newApp, error: appError } = await (admin.schema("recruitment") as any)
      .from("applications")
      .insert({
        job_id:         portalJob.id,
        candidate_id:   candidateId,
        source_channel: "seek_inbound",
        source_metadata: {
          seek_application_id: app?.id,
          seek_job_id:         job?.id,
          cv_url:              cvLink,
        },
        cv_storage_key:  null, // CV stored externally on Seek; would need to download & upload to Supabase Storage
        stage:           "applied",
      })
      .select("id")
      .single()

    if (appError) {
      results.push({ event_id: seek.id, status: "error", error: appError.message })
      continue
    }

    // Initial stage history
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin.schema("recruitment") as any)
      .from("application_stage_history")
      .insert({ application_id: newApp.id, from_stage: null, to_stage: "applied", changed_by: null })

    results.push({
      event_id:         seek.id,
      status:           "created",
      application_id:   newApp.id,
      candidate_id:     candidateId,
      candidate_action: candidateAction,
    })
  }

  return NextResponse.json({ received: results.length, results })
}
