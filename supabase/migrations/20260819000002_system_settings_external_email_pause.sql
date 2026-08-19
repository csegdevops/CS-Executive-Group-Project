-- ─────────────────────────────────────────────────────────────────────────────
-- System Settings — external email pause switch
-- Migration: 20260819000002_system_settings_external_email_pause.sql
--
-- Mirrors emails_paused/ai_paused: a second, independent kill switch that
-- only covers email sent to people outside the organisation (candidates via
-- src/lib/email/notifications/recruitment-candidates.ts, contractor/
-- supervisor notifications + invites via src/lib/email/notifications/
-- timesheets.ts and src/app/api/timesheets/{contractors,supervisors}).
-- Staff-to-staff email (src/lib/email/notifications.ts) is unaffected — it
-- only respects the existing emails_paused switch.
--
-- Defaults to true (external email held back) so email can be enabled for
-- internal use first, with external sending switched on explicitly later
-- once ready.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.system_settings
  ADD COLUMN external_emails_paused    boolean NOT NULL DEFAULT true,
  ADD COLUMN external_emails_paused_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN external_emails_paused_at timestamptz;
