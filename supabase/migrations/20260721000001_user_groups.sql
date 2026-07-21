-- ─────────────────────────────────────────────────────────────────────────────
-- User Groups — replaces per-user, per-module `user_module_access` grants with
-- reusable groups. A group grants a set of fine-grained permission keys
-- (e.g. 'regulatory.consultations.create'); users can belong to multiple
-- groups. Existing per-user grants are migrated into matching seeded groups
-- so nobody's access changes as a result of this switch.
-- Migration: 20260721000001_user_groups.sql
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_groups (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name        text NOT NULL UNIQUE,
  description text,
  created_at  timestamptz DEFAULT now(),
  created_by  uuid REFERENCES public.profiles(id)
);

CREATE TABLE IF NOT EXISTS public.user_group_permissions (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id       uuid NOT NULL REFERENCES public.user_groups(id) ON DELETE CASCADE,
  permission_key text NOT NULL,
  UNIQUE (group_id, permission_key)
);

CREATE TABLE IF NOT EXISTS public.user_group_members (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id   uuid NOT NULL REFERENCES public.user_groups(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  granted_at timestamptz DEFAULT now(),
  granted_by uuid REFERENCES public.profiles(id),
  UNIQUE (group_id, user_id)
);

-- ─── Seed default groups, translated from the old module×access_level shape ──

INSERT INTO public.user_groups (name, description) VALUES
  ('Regulatory Admin',   'Full admin access to the Regulatory module'),
  ('Regulatory Member',  'Standard member access to the Regulatory module'),
  ('Recruitment Admin',  'Full admin access to the Recruitment module'),
  ('Recruitment Member', 'Standard member access to the Recruitment module'),
  ('CRM Admin',          'Full admin access to the CRM module'),
  ('CRM Member',         'Standard member access to the CRM module')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.user_group_permissions (group_id, permission_key)
SELECT id, key FROM public.user_groups, unnest(ARRAY[
  'regulatory.access',
  'regulatory.consultations.create',
  'regulatory.consultations.edit',
  'regulatory.consultants.manage',
  'regulatory.chemicals.manage',
  'regulatory.regulatory_lists.manage',
  'regulatory.reference_data.manage',
  'companies.manage'
]) AS key
WHERE name = 'Regulatory Admin'
UNION ALL
SELECT id, 'regulatory.access' FROM public.user_groups WHERE name = 'Regulatory Member'
UNION ALL
SELECT id, key FROM public.user_groups, unnest(ARRAY[
  'recruitment.access',
  'recruitment.jobs.create',
  'recruitment.jobs.edit',
  'recruitment.candidates.create',
  'recruitment.candidates.edit',
  'recruitment.applications.create',
  'recruitment.applications.edit',
  'recruitment.placements.create',
  'recruitment.tasks.edit',
  'recruitment.reference_data.manage',
  'companies.manage'
]) AS key
WHERE name = 'Recruitment Admin'
UNION ALL
SELECT id, 'recruitment.access' FROM public.user_groups WHERE name = 'Recruitment Member'
UNION ALL
SELECT id, key FROM public.user_groups, unnest(ARRAY[
  'crm.access',
  'crm.opportunities.create',
  'crm.opportunities.edit',
  'crm.reference_data.manage',
  'companies.manage'
]) AS key
WHERE name = 'CRM Admin'
UNION ALL
SELECT id, 'crm.access' FROM public.user_groups WHERE name = 'CRM Member'
ON CONFLICT (group_id, permission_key) DO NOTHING;

-- ─── Migrate existing per-user module access into matching group membership ──
-- Guarded: user_module_access may already be absent (fresh DB, or a prior
-- partial run of this same migration already dropped it) — skip cleanly.

DO $$
BEGIN
  IF to_regclass('public.user_module_access') IS NOT NULL THEN
    INSERT INTO public.user_group_members (group_id, user_id, granted_by)
    SELECT g.id, uma.user_id, uma.granted_by
    FROM public.user_module_access uma
    JOIN public.user_groups g ON g.name = CASE
      WHEN uma.module = 'regulatory'  AND uma.access_level = 'admin'  THEN 'Regulatory Admin'
      WHEN uma.module = 'regulatory'  AND uma.access_level = 'member' THEN 'Regulatory Member'
      WHEN uma.module = 'recruitment' AND uma.access_level = 'admin'  THEN 'Recruitment Admin'
      WHEN uma.module = 'recruitment' AND uma.access_level = 'member' THEN 'Recruitment Member'
      WHEN uma.module = 'crm'         AND uma.access_level = 'admin'  THEN 'CRM Admin'
      WHEN uma.module = 'crm'         AND uma.access_level = 'member' THEN 'CRM Member'
    END
    ON CONFLICT (group_id, user_id) DO NOTHING;
  END IF;
END $$;

-- ─── RLS helper functions — now resolve access via granular permission keys ──

CREATE OR REPLACE FUNCTION has_module_access(mod text)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_group_members m
    JOIN public.user_group_permissions p ON p.group_id = m.group_id
    WHERE m.user_id = auth.uid() AND p.permission_key LIKE mod || '.%'
  ) OR is_admin()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- "Module admin" is now an emergent property: holding any permission in the
-- module beyond the bare view-only '<mod>.access' key implies broader
-- (module-admin-equivalent) RLS visibility, rather than a separate flag.
CREATE OR REPLACE FUNCTION is_module_admin(mod text)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_group_members m
    JOIN public.user_group_permissions p ON p.group_id = m.group_id
    WHERE m.user_id = auth.uid()
      AND p.permission_key LIKE mod || '.%'
      AND p.permission_key <> mod || '.access'
  ) OR is_admin()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ─── can_manage_lookup — rewritten off the new permission keys ───────────────

CREATE OR REPLACE FUNCTION can_manage_lookup(p_scope text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT
    is_admin()
    OR (
      p_scope <> 'global'
      AND EXISTS (
        SELECT 1
        FROM public.user_group_members m
        JOIN public.user_group_permissions p ON p.group_id = m.group_id
        WHERE m.user_id = auth.uid() AND p.permission_key = p_scope || '.reference_data.manage'
      )
    )
    OR (
      p_scope = 'global'
      AND EXISTS (
        SELECT 1
        FROM public.user_group_members m
        JOIN public.user_group_permissions p ON p.group_id = m.group_id
        WHERE m.user_id = auth.uid()
          AND p.permission_key IN (
            'regulatory.reference_data.manage',
            'recruitment.reference_data.manage',
            'crm.reference_data.manage'
          )
      )
    );
$$;

-- ─── Policies that referenced user_module_access directly ────────────────────

DROP POLICY IF EXISTS logs_select ON regulatory.consultation_logs;
CREATE POLICY "logs_select" ON regulatory.consultation_logs
  FOR SELECT USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
    OR is_module_admin('regulatory')
    OR EXISTS (
      SELECT 1 FROM regulatory.consultation_consultants
      WHERE consultation_id = consultation_logs.consultation_id
        AND consultant_id   = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Regulatory members can manage products" ON regulatory.consultation_products;
CREATE POLICY "Regulatory members can manage products" ON regulatory.consultation_products
  USING (
    EXISTS (
      SELECT 1
      FROM   regulatory.consultations c
      WHERE  c.id = consultation_id
      AND    has_module_access('regulatory')
    )
  );

-- ─── New-profile default: put new users in "Regulatory Member" ───────────────

CREATE OR REPLACE FUNCTION grant_default_module_access()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_group_members (group_id, user_id)
  SELECT id, NEW.id FROM public.user_groups WHERE name = 'Regulatory Member'
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Drop the superseded table ─────────────────────────────────────────────

DROP TABLE IF EXISTS public.user_module_access CASCADE;

-- ─── Row-Level Security ───────────────────────────────────────────────────────

ALTER TABLE public.user_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_group_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_group_members ENABLE ROW LEVEL SECURITY;

-- All access to these tables goes through API routes using the service-role
-- (admin) client — same pattern as regulatory.consultation_notes.
GRANT ALL ON public.user_groups TO service_role;
GRANT ALL ON public.user_group_permissions TO service_role;
GRANT ALL ON public.user_group_members TO service_role;
