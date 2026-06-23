-- ─────────────────────────────────────────────────────────────────────────────
-- Allowed Email Domains — controls which domains can self-register
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.allowed_email_domains (
  id        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  domain    text NOT NULL UNIQUE,
  added_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  added_at  timestamptz DEFAULT now()
);

-- Seed the default domain
INSERT INTO public.allowed_email_domains (domain) VALUES ('csexecgroup.com')
ON CONFLICT DO NOTHING;

-- RLS
ALTER TABLE public.allowed_email_domains ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read (their own registration UX needs to know)
CREATE POLICY "domains_select" ON public.allowed_email_domains
  FOR SELECT USING (true);

-- Only super admin can add or remove
CREATE POLICY "domains_insert" ON public.allowed_email_domains
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "domains_delete" ON public.allowed_email_domains
  FOR DELETE USING (is_admin());
