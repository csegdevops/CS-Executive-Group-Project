-- ─────────────────────────────────────────────────────────────────────────────
-- System Settings — global email pause switch
-- Migration: 20260806000002_system_settings_email_pause.sql
--
-- Singleton-row table (id boolean primary key check(id) enforces exactly one
-- row ever exists) so a super admin can pause all outbound Resend-based
-- notification/invite email in one click — useful once the system holds real
-- staff/contractor/supervisor email addresses and someone wants to click
-- through provisioning flows without actually emailing anyone.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.system_settings (
  id                boolean     PRIMARY KEY DEFAULT true CHECK (id),
  emails_paused     boolean     NOT NULL DEFAULT false,
  emails_paused_by  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  emails_paused_at  timestamptz,
  updated_at        timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.system_settings (id) VALUES (true);

CREATE TRIGGER system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Same shape as module_config: readable by any authenticated user, writes
-- only via the service-role client from the super-admin-gated API route.
CREATE POLICY "read system settings" ON public.system_settings
  FOR SELECT TO authenticated USING (true);

GRANT SELECT ON public.system_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_settings TO service_role;
