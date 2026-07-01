-- ─────────────────────────────────────────────────────────────────────────────
-- CRM Schema — Contacts, Activity Log, BD Pipeline
-- Migration: 20260701000001_crm_schema.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── CRM schema ──────────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS crm;

-- ─── Enhance public.companies ─────────────────────────────────────────────────
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS account_owner_id uuid
    REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS crm_status text DEFAULT 'prospect'
    CHECK (crm_status IN ('lead', 'prospect', 'client', 'inactive')),
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz;

-- ─── Contacts ─────────────────────────────────────────────────────────────────
CREATE TABLE public.contacts (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  first_name  text        NOT NULL,
  last_name   text        NOT NULL,
  title       text,
  email       text,
  phone       text,
  is_primary  boolean     NOT NULL DEFAULT false,
  notes       text,
  added_by    uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_contacts_company ON public.contacts (company_id);

CREATE TRIGGER contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── Company Activities ───────────────────────────────────────────────────────
CREATE TABLE public.company_activities (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  contact_id       uuid        REFERENCES public.contacts(id) ON DELETE SET NULL,
  activity_type    text        NOT NULL
                     CHECK (activity_type IN ('call', 'email', 'meeting', 'note')),
  subject          text        NOT NULL,
  body             text,
  occurred_at      timestamptz NOT NULL DEFAULT now(),
  performed_by     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  linked_module    text        CHECK (linked_module IN ('regulatory', 'recruitment', 'crm')),
  linked_record_id uuid,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_activities_company    ON public.company_activities (company_id, occurred_at DESC);
CREATE INDEX idx_activities_contact    ON public.company_activities (contact_id);
CREATE INDEX idx_activities_performer  ON public.company_activities (performed_by);

-- Trigger: keep companies.last_activity_at in sync
CREATE OR REPLACE FUNCTION update_company_last_activity()
RETURNS trigger AS $$
BEGIN
  UPDATE public.companies
  SET last_activity_at = NEW.occurred_at
  WHERE id = NEW.company_id
    AND (last_activity_at IS NULL OR NEW.occurred_at > last_activity_at);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_company_last_activity
  AFTER INSERT ON public.company_activities
  FOR EACH ROW EXECUTE FUNCTION update_company_last_activity();

-- ─── Opportunities ────────────────────────────────────────────────────────────
CREATE TABLE crm.opportunities (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid        NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  contact_id          uuid        REFERENCES public.contacts(id) ON DELETE SET NULL,
  title               text        NOT NULL,
  stage               text        NOT NULL DEFAULT 'lead'
                        CHECK (stage IN ('lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost')),
  value               numeric(12,2),
  currency            text        NOT NULL DEFAULT 'AUD',
  module              text        CHECK (module IN ('regulatory', 'recruitment', 'both')),
  assigned_to         uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  expected_close_date date,
  closed_at           timestamptz,
  close_reason        text,
  notes               text,
  created_by          uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_opp_company ON crm.opportunities (company_id);
CREATE INDEX idx_opp_stage   ON crm.opportunities (stage) WHERE stage NOT IN ('won', 'lost');

CREATE TRIGGER opportunities_updated_at
  BEFORE UPDATE ON crm.opportunities
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.contacts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.opportunities         ENABLE ROW LEVEL SECURITY;

-- Contacts + activities: any authenticated user (companies are already global)
CREATE POLICY contacts_authenticated ON public.contacts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY activities_authenticated ON public.company_activities
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Opportunities: CRM module members only
CREATE POLICY opportunities_crm_access ON crm.opportunities
  FOR ALL TO authenticated USING (has_module_access('crm'));

-- ─── Grants ───────────────────────────────────────────────────────────────────
GRANT USAGE ON SCHEMA crm TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES    IN SCHEMA crm TO authenticated, service_role;
GRANT USAGE, SELECT                  ON ALL SEQUENCES IN SCHEMA crm TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA crm
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA crm
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated, service_role;
