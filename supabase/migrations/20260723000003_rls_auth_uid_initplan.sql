-- ─────────────────────────────────────────────────────────────────────────────
-- Supabase performance advisor: these policies call auth.uid() directly in
-- their USING clause, which Postgres re-evaluates for every row scanned.
-- Wrapping it as (select auth.uid()) lets the planner hoist it into a
-- single initPlan evaluated once per query instead of once per row.
-- Behavior is unchanged — only the evaluation strategy differs.
-- Migration: 20260723000003_rls_auth_uid_initplan.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── public.profiles ──────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (id = (select auth.uid()) OR is_admin());

DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE USING (id = (select auth.uid()) OR is_admin());

-- ─── regulatory.consultant_company_assignments ────────────────────────────────

DROP POLICY IF EXISTS "assignments_select" ON regulatory.consultant_company_assignments;
CREATE POLICY "assignments_select" ON regulatory.consultant_company_assignments
  FOR SELECT USING (is_module_admin('regulatory') OR consultant_id = (select auth.uid()));

-- ─── regulatory.consultation_consultants ──────────────────────────────────────

DROP POLICY IF EXISTS "cc_consultants_select" ON regulatory.consultation_consultants;
CREATE POLICY "cc_consultants_select" ON regulatory.consultation_consultants
  FOR SELECT USING (is_module_admin('regulatory') OR consultant_id = (select auth.uid()));

-- ─── regulatory.consultation_logs ──────────────────────────────────────────────

DROP POLICY IF EXISTS "logs_select" ON regulatory.consultation_logs;
CREATE POLICY "logs_select" ON regulatory.consultation_logs
  FOR SELECT USING (
    (SELECT role FROM public.profiles WHERE id = (select auth.uid())) = 'super_admin'
    OR is_module_admin('regulatory')
    OR EXISTS (
      SELECT 1 FROM regulatory.consultation_consultants
      WHERE consultation_id = consultation_logs.consultation_id
        AND consultant_id   = (select auth.uid())
    )
  );
