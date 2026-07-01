-- ─────────────────────────────────────────────────────────────────────────────
-- Company address fields, branches, and contact enhancements
-- Migration: 20260701000002_branches_address.sql
-- Depends on: 20260701000001_crm_schema.sql (contacts table must exist)
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. Add structured address fields to companies ────────────────────────────

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS address_line1 text,
  ADD COLUMN IF NOT EXISTS address_line2 text,
  ADD COLUMN IF NOT EXISTS suburb        text,
  ADD COLUMN IF NOT EXISTS state         text,
  ADD COLUMN IF NOT EXISTS postcode      text;
-- country column already exists

-- ─── 2. Company branches ──────────────────────────────────────────────────────
-- Each company can have multiple branches (locations).
-- The first branch is always named "Head Office" and is created automatically
-- when a company is created (handled at the application layer).

CREATE TABLE public.company_branches (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name           text        NOT NULL DEFAULT 'Head Office',
  address_line1  text,
  address_line2  text,
  suburb         text,
  state          text,
  postcode       text,
  country        text        DEFAULT 'Australia',
  is_head_office boolean     NOT NULL DEFAULT false,
  is_active      boolean     NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER company_branches_updated_at
  BEFORE UPDATE ON public.company_branches
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_company_branches_company ON public.company_branches (company_id);

ALTER TABLE public.company_branches ENABLE ROW LEVEL SECURITY;
CREATE POLICY branches_authenticated ON public.company_branches
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_branches TO authenticated, service_role;

-- ─── 3. Contacts: branch assignment + module scope flags ──────────────────────

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS branch_id               uuid REFERENCES public.company_branches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS department              text,
  ADD COLUMN IF NOT EXISTS is_crm_contact          boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_regulatory_contact   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_recruitment_contact  boolean NOT NULL DEFAULT false;

CREATE INDEX idx_contacts_branch ON public.contacts (branch_id);

-- ─── 4. Migrate companies.industry from free text to lookup value slug ────────
-- The industry column stays text — it now stores the lookup value `value` slug
-- (e.g. 'mining_resources'). The label is resolved at display time via the
-- lookup_values table. Existing free-text values remain and are shown as-is;
-- admins can normalise them via the edit dialog.

-- ─────────────────────────────────────────────────────────────────────────────
