-- ─────────────────────────────────────────────────────────────────────────────
-- Multi-Module Platform — Initial Schema
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Module schemas ───────────────────────────────────────────────────────────

CREATE SCHEMA IF NOT EXISTS regulatory;
CREATE SCHEMA IF NOT EXISTS recruitment;
CREATE SCHEMA IF NOT EXISTS crm;

-- ─── Profiles (public) ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  role        text NOT NULL DEFAULT 'user'
                CHECK (role IN ('super_admin', 'user')),
  full_name   text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─── Companies (public) ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.companies (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name        text NOT NULL,
  abn         text UNIQUE,
  country     text,
  industry    text,
  notes       text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- ─── Module Access (public) ───────────────────────────────────────────────────
-- no row = no access; super_admin role bypasses all module checks

CREATE TABLE IF NOT EXISTS public.user_module_access (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  module       text NOT NULL CHECK (module IN ('regulatory', 'recruitment', 'crm')),
  access_level text NOT NULL CHECK (access_level IN ('admin', 'member')),
  granted_at   timestamptz DEFAULT now(),
  granted_by   uuid REFERENCES public.profiles(id),
  UNIQUE (user_id, module)
);

-- New users get 'member' access to regulatory by default
CREATE OR REPLACE FUNCTION grant_default_module_access()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_module_access (user_id, module, access_level)
  VALUES (NEW.id, 'regulatory', 'member')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_profile_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION grant_default_module_access();

-- ─── Regulatory: Consultant–Company Assignments ───────────────────────────────

CREATE TABLE IF NOT EXISTS regulatory.consultant_company_assignments (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  consultant_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id       uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  assignment_type  text NOT NULL DEFAULT 'primary'
                     CHECK (assignment_type IN ('primary', 'temporary')),
  start_date       timestamptz NOT NULL DEFAULT now(),
  end_date         timestamptz,
  notes            text,
  created_at       timestamptz DEFAULT now(),
  UNIQUE (consultant_id, company_id, assignment_type)
);

-- ─── Regulatory: Consultations ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS regulatory.consultations (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id       uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title            text NOT NULL,
  description      text,
  status           text NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','in_progress','under_review','completed','archived')),
  frameworks       text[] NOT NULL DEFAULT '{}',
  reference_number text UNIQUE,
  due_date         timestamptz,
  completed_at     timestamptz,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

-- ─── Regulatory: Chemicals ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS regulatory.chemicals (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  cas_number        text UNIQUE,
  iupac_name        text,
  common_name       text NOT NULL,
  molecular_formula text,
  molecular_weight  numeric,
  inchi_key         text UNIQUE,
  pubchem_cid       integer UNIQUE,
  needs_review      boolean NOT NULL DEFAULT false,
  resolved_at       timestamptz,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

-- ─── Regulatory: Chemical Aliases ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS regulatory.chemical_aliases (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  chemical_id  uuid NOT NULL REFERENCES regulatory.chemicals(id) ON DELETE CASCADE,
  alias        text NOT NULL,
  alias_type   text CHECK (alias_type IN ('trade_name','synonym','iupac','cas_rn')),
  source       text CHECK (source IN ('pubchem','echa','manual')),
  UNIQUE (chemical_id, alias)
);

CREATE INDEX IF NOT EXISTS idx_chemical_aliases_alias
  ON regulatory.chemical_aliases(lower(alias));

-- ─── Regulatory: Consultation Chemicals ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS regulatory.consultation_chemicals (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  consultation_id  uuid NOT NULL REFERENCES regulatory.consultations(id) ON DELETE CASCADE,
  chemical_id      uuid NOT NULL REFERENCES regulatory.chemicals(id),
  role             text,
  quantity         numeric,
  unit             text,
  notes            text,
  added_at         timestamptz DEFAULT now(),
  UNIQUE (consultation_id, chemical_id)
);

-- ─── Regulatory: Regulatory Listings ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS regulatory.regulatory_listings (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  chemical_id    uuid NOT NULL REFERENCES regulatory.chemicals(id) ON DELETE CASCADE,
  framework      text NOT NULL
                   CHECK (framework IN ('aicis','reach','tsca')),
  status         text NOT NULL DEFAULT 'unknown'
                   CHECK (status IN ('listed','not_listed','exempt','restricted','pending','unknown')),
  list_name      text,
  list_url       text,
  effective_date timestamptz,
  notes          text,
  last_checked   timestamptz DEFAULT now(),
  source         text CHECK (source IN ('api','manual')),
  UNIQUE (chemical_id, framework)
);

-- ─── Updated_at triggers ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER consultations_updated_at
  BEFORE UPDATE ON regulatory.consultations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER chemicals_updated_at
  BEFORE UPDATE ON regulatory.chemicals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── RLS Helper Functions ─────────────────────────────────────────────────────

-- Super admin check (replaces old is_admin / role='admin')
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
  SELECT role = 'super_admin' FROM public.profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Module-level admin (or super admin)
CREATE OR REPLACE FUNCTION is_module_admin(mod text)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_module_access
    WHERE user_id = auth.uid() AND module = mod AND access_level = 'admin'
  ) OR is_admin()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Any module access (member or admin, or super admin)
CREATE OR REPLACE FUNCTION has_module_access(mod text)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_module_access
    WHERE user_id = auth.uid() AND module = mod
  ) OR is_admin()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Company access via regulatory assignments
CREATE OR REPLACE FUNCTION has_company_access(cid uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM regulatory.consultant_company_assignments
    WHERE consultant_id = auth.uid()
      AND company_id = cid
      AND (end_date IS NULL OR end_date >= now())
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ─── Row-Level Security ───────────────────────────────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_module_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE regulatory.consultant_company_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE regulatory.consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE regulatory.chemicals ENABLE ROW LEVEL SECURITY;
ALTER TABLE regulatory.chemical_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE regulatory.consultation_chemicals ENABLE ROW LEVEL SECURITY;
ALTER TABLE regulatory.regulatory_listings ENABLE ROW LEVEL SECURITY;

-- profiles: own row + super admin sees all
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (id = auth.uid() OR is_admin());

CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE USING (id = auth.uid() OR is_admin());

-- module access: own rows + super admin manages all
CREATE POLICY "module_access_select" ON public.user_module_access
  FOR SELECT USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "module_access_manage" ON public.user_module_access
  FOR ALL USING (is_admin());

-- companies: module admin sees all; members see assigned only
CREATE POLICY "companies_select" ON public.companies
  FOR SELECT USING (is_module_admin('regulatory') OR has_company_access(id));

CREATE POLICY "companies_insert" ON public.companies
  FOR INSERT WITH CHECK (is_module_admin('regulatory'));

CREATE POLICY "companies_update" ON public.companies
  FOR UPDATE USING (is_module_admin('regulatory'));

-- assignments: module admin manages all; members see their own
CREATE POLICY "assignments_select" ON regulatory.consultant_company_assignments
  FOR SELECT USING (is_module_admin('regulatory') OR consultant_id = auth.uid());

CREATE POLICY "assignments_insert" ON regulatory.consultant_company_assignments
  FOR INSERT WITH CHECK (is_module_admin('regulatory'));

CREATE POLICY "assignments_update" ON regulatory.consultant_company_assignments
  FOR UPDATE USING (is_module_admin('regulatory'));

CREATE POLICY "assignments_delete" ON regulatory.consultant_company_assignments
  FOR DELETE USING (is_module_admin('regulatory'));

-- consultations: module admin sees all; members see their company's
CREATE POLICY "consultations_select" ON regulatory.consultations
  FOR SELECT USING (is_module_admin('regulatory') OR has_company_access(company_id));

CREATE POLICY "consultations_insert" ON regulatory.consultations
  FOR INSERT WITH CHECK (is_module_admin('regulatory') OR has_company_access(company_id));

CREATE POLICY "consultations_update" ON regulatory.consultations
  FOR UPDATE USING (is_module_admin('regulatory') OR has_company_access(company_id));

-- chemicals: all regulatory module users
CREATE POLICY "chemicals_select" ON regulatory.chemicals
  FOR SELECT USING (has_module_access('regulatory'));

CREATE POLICY "chemicals_insert" ON regulatory.chemicals
  FOR INSERT WITH CHECK (has_module_access('regulatory'));

CREATE POLICY "chemicals_update" ON regulatory.chemicals
  FOR UPDATE USING (has_module_access('regulatory'));

-- chemical_aliases: all regulatory module users
CREATE POLICY "aliases_select" ON regulatory.chemical_aliases
  FOR SELECT USING (has_module_access('regulatory'));

CREATE POLICY "aliases_insert" ON regulatory.chemical_aliases
  FOR INSERT WITH CHECK (has_module_access('regulatory'));

-- consultation_chemicals: follows consultation/company access
CREATE POLICY "cc_select" ON regulatory.consultation_chemicals
  FOR SELECT USING (
    is_module_admin('regulatory') OR EXISTS (
      SELECT 1 FROM regulatory.consultations c
      WHERE c.id = consultation_id AND has_company_access(c.company_id)
    )
  );

CREATE POLICY "cc_insert" ON regulatory.consultation_chemicals
  FOR INSERT WITH CHECK (
    is_module_admin('regulatory') OR EXISTS (
      SELECT 1 FROM regulatory.consultations c
      WHERE c.id = consultation_id AND has_company_access(c.company_id)
    )
  );

CREATE POLICY "cc_delete" ON regulatory.consultation_chemicals
  FOR DELETE USING (
    is_module_admin('regulatory') OR EXISTS (
      SELECT 1 FROM regulatory.consultations c
      WHERE c.id = consultation_id AND has_company_access(c.company_id)
    )
  );

-- regulatory_listings: all regulatory module users can read; writes via service role
CREATE POLICY "reg_listings_select" ON regulatory.regulatory_listings
  FOR SELECT USING (has_module_access('regulatory'));

CREATE POLICY "reg_listings_insert" ON regulatory.regulatory_listings
  FOR INSERT WITH CHECK (has_module_access('regulatory'));

CREATE POLICY "reg_listings_update" ON regulatory.regulatory_listings
  FOR UPDATE USING (has_module_access('regulatory'));
