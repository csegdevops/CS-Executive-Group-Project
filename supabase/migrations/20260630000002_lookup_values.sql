-- ─────────────────────────────────────────────────────────────────────────────
-- Configurable Lookup Values
-- Migration: 20260630000002_lookup_values.sql
-- Provides: generic key-value reference data managed by module admins.
-- Scopes: 'global' (any module admin), or a specific module name.
-- Initial categories: company_industry, security_clearance_level,
--                     employment_type, skill_tag
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.lookup_values (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  scope       text        NOT NULL CHECK (scope IN ('global', 'regulatory', 'recruitment', 'crm')),
  category    text        NOT NULL,
  value       text        NOT NULL,
  label       text        NOT NULL,
  sort_order  integer     NOT NULL DEFAULT 0,
  is_active   boolean     NOT NULL DEFAULT true,
  created_by  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scope, category, value)
);

CREATE TRIGGER lookup_values_updated_at
  BEFORE UPDATE ON public.lookup_values
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_lookup_values_scope_category ON public.lookup_values (scope, category, sort_order);

-- ─── Helper: permission check for write operations ────────────────────────────
-- global scope: any module admin or super_admin
-- module scope: that module's admin or super_admin

CREATE OR REPLACE FUNCTION can_manage_lookup(p_scope text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT
    is_admin()
    OR (
      p_scope = 'global'
      AND EXISTS (
        SELECT 1 FROM public.user_module_access
        WHERE user_id = auth.uid()
          AND access_level = 'admin'
      )
    )
    OR (
      p_scope <> 'global'
      AND is_module_admin(p_scope)
    );
$$;

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.lookup_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY lookup_values_select ON public.lookup_values
  FOR SELECT TO authenticated USING (true);

CREATE POLICY lookup_values_insert ON public.lookup_values
  FOR INSERT TO authenticated WITH CHECK (can_manage_lookup(scope));

CREATE POLICY lookup_values_update ON public.lookup_values
  FOR UPDATE TO authenticated
  USING (can_manage_lookup(scope))
  WITH CHECK (can_manage_lookup(scope));

CREATE POLICY lookup_values_delete ON public.lookup_values
  FOR DELETE TO authenticated USING (can_manage_lookup(scope));

-- ─── Grants ───────────────────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lookup_values TO authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

-- ─── Seed: Company Industries (global) ───────────────────────────────────────

INSERT INTO public.lookup_values (scope, category, value, label, sort_order) VALUES
  ('global', 'company_industry', 'aerospace_defence',    'Aerospace & Defence',        10),
  ('global', 'company_industry', 'agriculture',          'Agriculture',                20),
  ('global', 'company_industry', 'automotive',           'Automotive',                 30),
  ('global', 'company_industry', 'banking_finance',      'Banking & Finance',          40),
  ('global', 'company_industry', 'biotechnology',        'Biotechnology',              50),
  ('global', 'company_industry', 'construction',         'Construction',               60),
  ('global', 'company_industry', 'consulting',           'Consulting',                 70),
  ('global', 'company_industry', 'consumer_goods',       'Consumer Goods',             80),
  ('global', 'company_industry', 'education',            'Education',                  90),
  ('global', 'company_industry', 'energy_utilities',     'Energy & Utilities',        100),
  ('global', 'company_industry', 'engineering',          'Engineering',               110),
  ('global', 'company_industry', 'government',           'Government & Public Sector', 120),
  ('global', 'company_industry', 'healthcare',           'Healthcare',                130),
  ('global', 'company_industry', 'hospitality_tourism',  'Hospitality & Tourism',     140),
  ('global', 'company_industry', 'information_technology','Information Technology',   150),
  ('global', 'company_industry', 'insurance',            'Insurance',                 160),
  ('global', 'company_industry', 'legal',                'Legal',                     170),
  ('global', 'company_industry', 'logistics_transport',  'Logistics & Transport',     180),
  ('global', 'company_industry', 'manufacturing',        'Manufacturing',             190),
  ('global', 'company_industry', 'media_communications', 'Media & Communications',    200),
  ('global', 'company_industry', 'mining_resources',     'Mining & Resources',        210),
  ('global', 'company_industry', 'non_profit',           'Non-Profit',                220),
  ('global', 'company_industry', 'pharmaceuticals',      'Pharmaceuticals',           230),
  ('global', 'company_industry', 'professional_services','Professional Services',     240),
  ('global', 'company_industry', 'real_estate',          'Real Estate',               250),
  ('global', 'company_industry', 'retail',               'Retail',                    260),
  ('global', 'company_industry', 'telecommunications',   'Telecommunications',        270),
  ('global', 'company_industry', 'wholesale',            'Wholesale',                 280)
ON CONFLICT (scope, category, value) DO NOTHING;

-- ─── Seed: Security Clearance Levels (global) ────────────────────────────────

INSERT INTO public.lookup_values (scope, category, value, label, sort_order) VALUES
  ('global', 'security_clearance_level', 'baseline', 'Baseline',                     10),
  ('global', 'security_clearance_level', 'nv1',      'NV1 (Negative Vetting 1)',     20),
  ('global', 'security_clearance_level', 'nv2',      'NV2 (Negative Vetting 2)',     30),
  ('global', 'security_clearance_level', 'pv',       'PV (Positive Vetting)',        40),
  ('global', 'security_clearance_level', 'tsc',      'TSC (Top Secret Codeword)',    50)
ON CONFLICT (scope, category, value) DO NOTHING;

-- ─── Seed: Employment Types (recruitment) ────────────────────────────────────

INSERT INTO public.lookup_values (scope, category, value, label, sort_order) VALUES
  ('recruitment', 'employment_type', 'permanent', 'Permanent', 10),
  ('recruitment', 'employment_type', 'contract',  'Contract',  20),
  ('recruitment', 'employment_type', 'casual',    'Casual',    30)
ON CONFLICT (scope, category, value) DO NOTHING;

-- ─── Seed: Candidate Skill Tags (recruitment) ────────────────────────────────

INSERT INTO public.lookup_values (scope, category, value, label, sort_order) VALUES
  ('recruitment', 'skill_tag', 'program_management',   'Program Management',    10),
  ('recruitment', 'skill_tag', 'project_management',   'Project Management',    20),
  ('recruitment', 'skill_tag', 'risk_management',      'Risk Management',       30),
  ('recruitment', 'skill_tag', 'stakeholder_management','Stakeholder Management',40),
  ('recruitment', 'skill_tag', 'defence_acquisition',  'Defence Acquisition',   50),
  ('recruitment', 'skill_tag', 'systems_engineering',  'Systems Engineering',   60),
  ('recruitment', 'skill_tag', 'software_engineering', 'Software Engineering',  70),
  ('recruitment', 'skill_tag', 'cybersecurity',        'Cybersecurity',         80),
  ('recruitment', 'skill_tag', 'cloud_architecture',   'Cloud Architecture',    90),
  ('recruitment', 'skill_tag', 'solution_architecture','Solution Architecture', 100),
  ('recruitment', 'skill_tag', 'network_engineering',  'Network Engineering',   110),
  ('recruitment', 'skill_tag', 'policy_analysis',      'Policy Analysis',       120),
  ('recruitment', 'skill_tag', 'change_management',    'Change Management',     130),
  ('recruitment', 'skill_tag', 'business_analysis',    'Business Analysis',     140),
  ('recruitment', 'skill_tag', 'data_analytics',       'Data Analytics',        150)
ON CONFLICT (scope, category, value) DO NOTHING;
