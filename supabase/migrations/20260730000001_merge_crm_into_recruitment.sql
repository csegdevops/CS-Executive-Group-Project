-- ─────────────────────────────────────────────────────────────────────────────
-- Merge CRM into Recruitment (full module merge)
-- Migration: 20260730000001_merge_crm_into_recruitment.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Pre-cleanup: reassign crm-scoped rows before tightening CHECK constraints ──
UPDATE public.company_activities SET linked_module = 'recruitment' WHERE linked_module = 'crm';

UPDATE public.lookup_values SET scope = 'recruitment'
WHERE scope = 'crm'
  AND NOT EXISTS (
    SELECT 1 FROM public.lookup_values lv2
    WHERE lv2.scope = 'recruitment' AND lv2.category = lookup_values.category AND lv2.value = lookup_values.value
  );
DELETE FROM public.lookup_values WHERE scope = 'crm';

DELETE FROM public.module_config WHERE module = 'crm';

-- ─── Move crm.opportunities into the recruitment schema ─────────────────────────
ALTER TABLE crm.opportunities SET SCHEMA recruitment;

DROP POLICY IF EXISTS opportunities_crm_access ON recruitment.opportunities;
CREATE POLICY recruitment_module_access ON recruitment.opportunities
  FOR ALL TO authenticated USING ((select has_module_access('recruitment')));

GRANT SELECT, INSERT, UPDATE, DELETE ON recruitment.opportunities TO authenticated, service_role;

-- ─── Drop the now-empty crm schema ────────────────────────────────────────────
DROP SCHEMA crm CASCADE;

-- ─── can_manage_lookup: drop the crm branch from the global-scope check ─────────
CREATE OR REPLACE FUNCTION public.can_manage_lookup(p_scope text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public' AS $$
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
            'recruitment.reference_data.manage'
          )
      )
    );
$$;

-- ─── Tighten CHECK constraints now that crm-scoped data is gone ────────────────
ALTER TABLE public.company_activities
  DROP CONSTRAINT company_activities_linked_module_check,
  ADD CONSTRAINT company_activities_linked_module_check
    CHECK (linked_module IN ('regulatory', 'recruitment'));

ALTER TABLE public.module_config
  DROP CONSTRAINT module_config_module_check,
  ADD CONSTRAINT module_config_module_check
    CHECK (module IN ('regulatory', 'recruitment'));

-- 'timesheets' is a specced-but-unbuilt future module already wired into the
-- permissions UI (PermissionsPicker.tsx TABS) — keep it, only 'crm' drops.
ALTER TABLE public.lookup_values
  DROP CONSTRAINT lookup_values_scope_check,
  ADD CONSTRAINT lookup_values_scope_check
    CHECK (scope IN ('global', 'regulatory', 'recruitment', 'timesheets'));

-- ─── Simplify shared-table RLS: drop the now-meaningless crm disjunct ──────────
ALTER POLICY contacts_authenticated ON public.contacts
  USING (
    (select has_module_access('regulatory'))
    OR (select has_module_access('recruitment'))
  )
  WITH CHECK (
    (select has_module_access('regulatory'))
    OR (select has_module_access('recruitment'))
  );

ALTER POLICY activities_authenticated ON public.company_activities
  USING (
    (select has_module_access('regulatory'))
    OR (select has_module_access('recruitment'))
  )
  WITH CHECK (
    (select has_module_access('regulatory'))
    OR (select has_module_access('recruitment'))
  );

ALTER POLICY branches_authenticated ON public.company_branches
  USING (
    (select has_module_access('regulatory'))
    OR (select has_module_access('recruitment'))
  )
  WITH CHECK (
    (select has_module_access('regulatory'))
    OR (select has_module_access('recruitment'))
  );
