-- ─────────────────────────────────────────────────────────────────────────────
-- Editable outgoing email templates — subject/body/recipients for every
-- Resend-based notification become admin-editable instead of hardcoded.
-- The dynamic "To" recipient (assigned consultant/recruiter/candidate/etc.)
-- stays resolved by business logic in application code; this table only adds
-- CC/BCC via security groups (public.user_groups) and lets the wording be
-- edited without a deploy. {{variableName}} tokens in subject/body_html/
-- body_text are substituted at send time — see src/lib/email/send-templated.ts.
--
-- Seed content below is the exact output of rendering each existing
-- src/lib/email/templates/*.tsx component (via @react-email/render, both
-- normal and plainText modes) with each prop replaced by its {{token}}, so
-- rollout changes zero visible behavior. Those 11 template components are
-- deleted in this same change — this table is now their source of truth.
-- Migration: 20260819000004_email_templates.sql
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.email_templates (
  template_key  text PRIMARY KEY,
  subject       text NOT NULL,
  body_html     text NOT NULL,
  body_text     text NOT NULL,
  cc_group_ids  uuid[] NOT NULL DEFAULT '{}',
  bcc_group_ids uuid[] NOT NULL DEFAULT '{}',
  updated_at    timestamptz DEFAULT now(),
  updated_by    uuid REFERENCES public.profiles(id)
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- All access goes through API routes using the service-role (admin) client —
-- same pattern as public.user_groups / regulatory.consultation_notes.
GRANT ALL ON public.email_templates TO service_role;

INSERT INTO public.email_templates (template_key, subject, body_html, body_text) VALUES

('consultation_status_changed',
 'Consultation status updated: {{consultationTitle}}',
$$<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd"><html dir="ltr" lang="en"><head><meta content="text/html; charset=UTF-8" http-equiv="Content-Type"/><meta name="x-apple-disable-message-reformatting"/></head><body><table border="0" width="100%" cellPadding="0" cellSpacing="0" role="presentation" align="center"><tbody><tr><td style="font-family:sans-serif"><table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="max-width:37.5em"><tbody><tr style="width:100%"><td><h1>Consultation status updated</h1><p style="font-size:14px;line-height:24px;margin-top:16px;margin-bottom:16px"><strong>{{consultationTitle}}</strong> moved from <strong>{{oldStatus}}</strong> to <strong>{{newStatus}}</strong>.</p><a href="{{consultationUrl}}" style="line-height:100%;text-decoration:none;display:inline-block;max-width:100%;mso-padding-alt:0px" target="_blank"><span style="max-width:100%;display:inline-block;line-height:120%;mso-padding-alt:0px">View consultation</span></a></td></tr></tbody></table></td></tr></tbody></table></body></html>$$,
$$CONSULTATION STATUS UPDATED

{{consultationTitle}} moved from {{oldStatus}} to {{newStatus}}.

View consultation {{consultationUrl}}$$),

('consultant_assigned',
 'You''ve been assigned to {{consultationTitle}}',
$$<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd"><html dir="ltr" lang="en"><head><meta content="text/html; charset=UTF-8" http-equiv="Content-Type"/><meta name="x-apple-disable-message-reformatting"/></head><body><table border="0" width="100%" cellPadding="0" cellSpacing="0" role="presentation" align="center"><tbody><tr><td style="font-family:sans-serif"><table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="max-width:37.5em"><tbody><tr style="width:100%"><td><h1>You&#x27;ve been assigned as consultant</h1><p style="font-size:14px;line-height:24px;margin-top:16px;margin-bottom:16px">You&#x27;ve been assigned to <strong>{{consultationTitle}}</strong> for <strong>{{companyName}}</strong>.</p><a href="{{consultationUrl}}" style="line-height:100%;text-decoration:none;display:inline-block;max-width:100%;mso-padding-alt:0px" target="_blank"><span style="max-width:100%;display:inline-block;line-height:120%;mso-padding-alt:0px">View consultation</span></a></td></tr></tbody></table></td></tr></tbody></table></body></html>$$,
$$YOU'VE BEEN ASSIGNED AS CONSULTANT

You've been assigned to {{consultationTitle}} for {{companyName}}.

View consultation {{consultationUrl}}$$),

('due_date_reminder',
 'Due soon: {{consultationTitle}}',
$$<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd"><html dir="ltr" lang="en"><head><meta content="text/html; charset=UTF-8" http-equiv="Content-Type"/><meta name="x-apple-disable-message-reformatting"/></head><body><table border="0" width="100%" cellPadding="0" cellSpacing="0" role="presentation" align="center"><tbody><tr><td style="font-family:sans-serif"><table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="max-width:37.5em"><tbody><tr style="width:100%"><td><h1>Consultation due date approaching</h1><p style="font-size:14px;line-height:24px;margin-top:16px;margin-bottom:16px"><strong>{{consultationTitle}}</strong> is due on <strong>{{dueDate}}</strong>.</p><a href="{{consultationUrl}}" style="line-height:100%;text-decoration:none;display:inline-block;max-width:100%;mso-padding-alt:0px" target="_blank"><span style="max-width:100%;display:inline-block;line-height:120%;mso-padding-alt:0px">View consultation</span></a></td></tr></tbody></table></td></tr></tbody></table></body></html>$$,
$$CONSULTATION DUE DATE APPROACHING

{{consultationTitle}} is due on {{dueDate}}.

View consultation {{consultationUrl}}$$),

('job_details_changed',
 '{{jobTitle}}: {{field}} updated',
$$<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd"><html dir="ltr" lang="en"><head><meta content="text/html; charset=UTF-8" http-equiv="Content-Type"/><meta name="x-apple-disable-message-reformatting"/></head><body><table border="0" width="100%" cellPadding="0" cellSpacing="0" role="presentation" align="center"><tbody><tr><td style="font-family:sans-serif"><table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="max-width:37.5em"><tbody><tr style="width:100%"><td><h1>Job {{field}} updated</h1><p style="font-size:14px;line-height:24px;margin-top:16px;margin-bottom:16px"><strong>{{jobTitle}}</strong>&#x27;s {{field}} changed from <strong>{{oldValue}}</strong> to <strong>{{newValue}}</strong>.</p><a href="{{jobUrl}}" style="line-height:100%;text-decoration:none;display:inline-block;max-width:100%;mso-padding-alt:0px" target="_blank"><span style="max-width:100%;display:inline-block;line-height:120%;mso-padding-alt:0px">View job</span></a></td></tr></tbody></table></td></tr></tbody></table></body></html>$$,
$$JOB {{field}} UPDATED

{{jobTitle}}'s {{field}} changed from {{oldValue}} to {{newValue}}.

View job {{jobUrl}}$$),

('contract_established',
 'Contract established: {{candidateName}} for {{jobTitle}}',
$$<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd"><html dir="ltr" lang="en"><head><meta content="text/html; charset=UTF-8" http-equiv="Content-Type"/><meta name="x-apple-disable-message-reformatting"/></head><body><table border="0" width="100%" cellPadding="0" cellSpacing="0" role="presentation" align="center"><tbody><tr><td style="font-family:sans-serif"><table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="max-width:37.5em"><tbody><tr style="width:100%"><td><h1>Contract established</h1><p style="font-size:14px;line-height:24px;margin-top:16px;margin-bottom:16px"><strong>{{candidateName}}</strong> has been placed for <strong>{{jobTitle}}</strong>, starting <strong>{{startDate}}</strong>.</p><a href="{{jobUrl}}" style="line-height:100%;text-decoration:none;display:inline-block;max-width:100%;mso-padding-alt:0px" target="_blank"><span style="max-width:100%;display:inline-block;line-height:120%;mso-padding-alt:0px">View job</span></a></td></tr></tbody></table></td></tr></tbody></table></body></html>$$,
$$CONTRACT ESTABLISHED

{{candidateName}} has been placed for {{jobTitle}}, starting {{startDate}}.

View job {{jobUrl}}$$),

('contract_expiring',
 'Contract expiring soon: {{candidateName}} for {{jobTitle}}',
$$<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd"><html dir="ltr" lang="en"><head><meta content="text/html; charset=UTF-8" http-equiv="Content-Type"/><meta name="x-apple-disable-message-reformatting"/></head><body><table border="0" width="100%" cellPadding="0" cellSpacing="0" role="presentation" align="center"><tbody><tr><td style="font-family:sans-serif"><table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="max-width:37.5em"><tbody><tr style="width:100%"><td><h1>Contract expiring soon</h1><p style="font-size:14px;line-height:24px;margin-top:16px;margin-bottom:16px"><strong>{{candidateName}}</strong>&#x27;s contract for <strong>{{jobTitle}}</strong> ends on <strong>{{finishDate}}</strong>.</p><a href="{{jobUrl}}" style="line-height:100%;text-decoration:none;display:inline-block;max-width:100%;mso-padding-alt:0px" target="_blank"><span style="max-width:100%;display:inline-block;line-height:120%;mso-padding-alt:0px">View job</span></a></td></tr></tbody></table></td></tr></tbody></table></body></html>$$,
$$CONTRACT EXPIRING SOON

{{candidateName}}'s contract for {{jobTitle}} ends on {{finishDate}}.

View job {{jobUrl}}$$),

('opportunity_stage_changed',
 '{{opportunityTitle}} moved to {{newStage}}',
$$<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd"><html dir="ltr" lang="en"><head><meta content="text/html; charset=UTF-8" http-equiv="Content-Type"/><meta name="x-apple-disable-message-reformatting"/></head><body><table border="0" width="100%" cellPadding="0" cellSpacing="0" role="presentation" align="center"><tbody><tr><td style="font-family:sans-serif"><table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="max-width:37.5em"><tbody><tr style="width:100%"><td><h1>Opportunity stage updated</h1><p style="font-size:14px;line-height:24px;margin-top:16px;margin-bottom:16px"><strong>{{opportunityTitle}}</strong> moved from <strong>{{oldStage}}</strong> to <strong>{{newStage}}</strong>.</p><a href="{{opportunityUrl}}" style="line-height:100%;text-decoration:none;display:inline-block;max-width:100%;mso-padding-alt:0px" target="_blank"><span style="max-width:100%;display:inline-block;line-height:120%;mso-padding-alt:0px">View opportunity</span></a></td></tr></tbody></table></td></tr></tbody></table></body></html>$$,
$$OPPORTUNITY STAGE UPDATED

{{opportunityTitle}} moved from {{oldStage}} to {{newStage}}.

View opportunity {{opportunityUrl}}$$),

('timesheet_submitted',
 '{{contractorName}} submitted a timesheet for approval',
$$<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd"><html dir="ltr" lang="en"><head><meta content="text/html; charset=UTF-8" http-equiv="Content-Type"/><meta name="x-apple-disable-message-reformatting"/></head><body><table border="0" width="100%" cellPadding="0" cellSpacing="0" role="presentation" align="center"><tbody><tr><td style="font-family:sans-serif"><table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="max-width:37.5em"><tbody><tr style="width:100%"><td><h1>Timesheet submitted</h1><p style="font-size:14px;line-height:24px;margin-top:16px;margin-bottom:16px"><strong>{{contractorName}}</strong> submitted their timesheet for the week of <strong>{{weekStarting}}</strong> and it&#x27;s waiting on your approval.</p><a href="{{approvalUrl}}" style="line-height:100%;text-decoration:none;display:inline-block;max-width:100%;mso-padding-alt:0px" target="_blank"><span style="max-width:100%;display:inline-block;line-height:120%;mso-padding-alt:0px">Review timesheet</span></a></td></tr></tbody></table></td></tr></tbody></table></body></html>$$,
$$TIMESHEET SUBMITTED

{{contractorName}} submitted their timesheet for the week of {{weekStarting}} and it's waiting on your approval.

Review timesheet {{approvalUrl}}$$),

('timesheet_declined',
 'Timesheet declined: week of {{weekStarting}}',
$$<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd"><html dir="ltr" lang="en"><head><meta content="text/html; charset=UTF-8" http-equiv="Content-Type"/><meta name="x-apple-disable-message-reformatting"/></head><body><table border="0" width="100%" cellPadding="0" cellSpacing="0" role="presentation" align="center"><tbody><tr><td style="font-family:sans-serif"><table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="max-width:37.5em"><tbody><tr style="width:100%"><td><h1>Timesheet declined</h1><p style="font-size:14px;line-height:24px;margin-top:16px;margin-bottom:16px">Your timesheet for the week of <strong>{{weekStarting}}</strong> was declined:</p><p style="font-size:14px;line-height:24px;padding:12px;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;margin-top:16px;margin-bottom:16px">{{reason}}</p><p style="font-size:14px;line-height:24px;margin-top:16px;margin-bottom:16px">Amend the entries and resubmit when you&#x27;re ready.</p><a href="{{timesheetUrl}}" style="line-height:100%;text-decoration:none;display:inline-block;max-width:100%;mso-padding-alt:0px" target="_blank"><span style="max-width:100%;display:inline-block;line-height:120%;mso-padding-alt:0px">Amend timesheet</span></a></td></tr></tbody></table></td></tr></tbody></table></body></html>$$,
$$TIMESHEET DECLINED

Your timesheet for the week of {{weekStarting}} was declined:

{{reason}}

Amend the entries and resubmit when you're ready.

Amend timesheet {{timesheetUrl}}$$),

('timesheet_approved',
 'Timesheet approved: week of {{weekStarting}}',
$$<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd"><html dir="ltr" lang="en"><head><meta content="text/html; charset=UTF-8" http-equiv="Content-Type"/><meta name="x-apple-disable-message-reformatting"/></head><body><table border="0" width="100%" cellPadding="0" cellSpacing="0" role="presentation" align="center"><tbody><tr><td style="font-family:sans-serif"><table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="max-width:37.5em"><tbody><tr style="width:100%"><td><h1>Timesheet approved</h1><p style="font-size:14px;line-height:24px;margin-top:16px;margin-bottom:16px">Your timesheet for the week of <strong>{{weekStarting}}</strong> has been approved.</p><a href="{{timesheetUrl}}" style="line-height:100%;text-decoration:none;display:inline-block;max-width:100%;mso-padding-alt:0px" target="_blank"><span style="max-width:100%;display:inline-block;line-height:120%;mso-padding-alt:0px">View timesheet</span></a></td></tr></tbody></table></td></tr></tbody></table></body></html>$$,
$$TIMESHEET APPROVED

Your timesheet for the week of {{weekStarting}} has been approved.

View timesheet {{timesheetUrl}}$$),

('application_unsuccessful',
 'Update on your application: {{jobTitle}}',
$$<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd"><html dir="ltr" lang="en"><head><meta content="text/html; charset=UTF-8" http-equiv="Content-Type"/><meta name="x-apple-disable-message-reformatting"/></head><body><table border="0" width="100%" cellPadding="0" cellSpacing="0" role="presentation" align="center"><tbody><tr><td style="font-family:sans-serif"><table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="max-width:37.5em"><tbody><tr style="width:100%"><td><h1>Thank you for your application</h1><p style="font-size:14px;line-height:24px;margin-top:16px;margin-bottom:16px">Dear {{candidateName}},</p><p style="font-size:14px;line-height:24px;margin-top:16px;margin-bottom:16px">Thank you for your interest in the <strong>{{jobTitle}}</strong> role at <strong>{{companyName}}</strong> and for taking the time to apply. After careful consideration, we&#x27;ve decided to move forward with other candidates for this position.</p><p style="font-size:14px;line-height:24px;margin-top:16px;margin-bottom:16px">We appreciate the effort you put into your application and encourage you to apply for future roles that match your skills and experience.</p><p style="font-size:14px;line-height:24px;margin-top:16px;margin-bottom:16px">Kind regards</p></td></tr></tbody></table></td></tr></tbody></table></body></html>$$,
$$THANK YOU FOR YOUR APPLICATION

Dear {{candidateName}},

Thank you for your interest in the {{jobTitle}} role at {{companyName}} and for taking the time to apply. After careful consideration, we've decided to move forward with other candidates for this position.

We appreciate the effort you put into your application and encourage you to apply for future roles that match your skills and experience.

Kind regards$$)

ON CONFLICT (template_key) DO NOTHING;
