import { createResendClient, EMAIL_FROM } from "./client"
import { createAdminClient } from "@/lib/supabase/admin"
import { isEmailPaused, isExternalEmailPaused } from "./pause"
import { substituteVariables } from "./template-registry"
import { resolveGroupEmails } from "./resolve-group-recipients"

/**
 * Single send path for every outgoing notification, replacing the 3
 * duplicated local send() helpers that used to live in notifications.ts /
 * notifications/timesheets.ts / notifications/recruitment-candidates.ts.
 * Loads the admin-editable row from public.email_templates, substitutes
 * {{variables}}, resolves cc_group_ids/bcc_group_ids into addresses, and
 * calls Resend. The primary `to` recipient is always resolved by the caller's
 * business logic (assigned consultant/recruiter/candidate/etc.) — CC/BCC
 * groups are the only admin-configurable recipients, so a misconfigured
 * template can never stop the actually-responsible person being notified.
 *
 * Returns false (without throwing) if the template is missing, paused, or
 * the Resend call fails — callers that need to know can check the result;
 * others can ignore it, same as today.
 */
export async function sendTemplatedEmail(
  templateKey: string,
  vars: Record<string, string>,
  opts: {
    to: string
    external?: boolean
    /** Preview an unsaved draft (admin editor "send test") instead of the saved row's subject/body. */
    contentOverride?: { subject: string; body_html: string; body_text: string }
  }
): Promise<boolean> {
  if (await isEmailPaused()) {
    console.log("[email] paused — skipped", { to: opts.to, templateKey })
    return false
  }
  if (opts.external && (await isExternalEmailPaused())) {
    console.log("[email] external paused — skipped", { to: opts.to, templateKey })
    return false
  }

  const admin = createAdminClient()
  const { data: row, error } = await admin
    .from("email_templates")
    .select("subject, body_html, body_text, cc_group_ids, bcc_group_ids")
    .eq("template_key", templateKey)
    .single()

  if (error || !row) {
    console.error("[email] template not found", { templateKey, error })
    return false
  }

  const content = opts.contentOverride ?? row

  // Platform-wide constants every template can reference, so individual
  // sendXxxEmail() callers don't each have to pass a logo URL. Hardcoded to
  // the production host (not NEXT_PUBLIC_BASE_URL) because the image must be
  // fetchable by the *recipient's* mail client wherever it's opened — a send
  // triggered from local dev would otherwise embed an unreachable
  // http://localhost:... URL that only resolves on the sending machine.
  const allVars = { logoUrl: "https://portal.csexecutivegroup.com/cseg_logo_new.png", ...vars }

  const subject = substituteVariables(content.subject, allVars)
  const html = substituteVariables(content.body_html, allVars)
  const text = substituteVariables(content.body_text, allVars)

  const [ccEmails, bccEmails] = await Promise.all([
    resolveGroupEmails(row.cc_group_ids ?? []),
    resolveGroupEmails(row.bcc_group_ids ?? []),
  ])
  const cc = ccEmails.filter((e) => e !== opts.to)
  const bcc = bccEmails.filter((e) => e !== opts.to && !cc.includes(e))

  try {
    const resend = createResendClient()
    await resend.emails.send({
      from: EMAIL_FROM,
      to: opts.to,
      subject,
      html,
      text,
      ...(cc.length ? { cc } : {}),
      ...(bcc.length ? { bcc } : {}),
    })
    return true
  } catch (err) {
    console.error("[email] send failed", { to: opts.to, templateKey, err })
    return false
  }
}
