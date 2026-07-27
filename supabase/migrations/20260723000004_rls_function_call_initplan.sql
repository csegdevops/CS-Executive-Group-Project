-- ─────────────────────────────────────────────────────────────────────────────
-- Extend the auth.uid() initplan fix (20260723000003) to every other RLS
-- policy that calls is_admin() / is_module_admin(mod) / has_module_access(mod)
-- directly with a constant argument. These functions are SECURITY DEFINER,
-- so Postgres cannot inline them into the calling query — each call is a
-- real per-row function invocation unless wrapped in (select ...), which
-- lets the planner hoist it into a single initPlan evaluated once per query.
--
-- Deliberately NOT touched: has_company_access(id / company_id / c.company_id)
-- and can_manage_lookup(scope) — these take a column from the current row as
-- their argument, so they must legitimately be re-evaluated per row; wrapping
-- them would be a no-op at best.
-- Migration: 20260723000004_rls_function_call_initplan.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── public.profiles ──────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (id = (select auth.uid()) OR (select is_admin()));

DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE USING (id = (select auth.uid()) OR (select is_admin()));

-- ─── public.companies ──────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "companies_select" ON public.companies;
CREATE POLICY "companies_select" ON public.companies
  FOR SELECT USING ((select is_module_admin('regulatory')) OR has_company_access(id));

DROP POLICY IF EXISTS "companies_insert" ON public.companies;
CREATE POLICY "companies_insert" ON public.companies
  FOR INSERT WITH CHECK ((select is_module_admin('regulatory')));

DROP POLICY IF EXISTS "companies_update" ON public.companies;
CREATE POLICY "companies_update" ON public.companies
  FOR UPDATE USING ((select is_module_admin('regulatory')));

-- ─── regulatory.consultant_company_assignments ────────────────────────────────

DROP POLICY IF EXISTS "assignments_select" ON regulatory.consultant_company_assignments;
CREATE POLICY "assignments_select" ON regulatory.consultant_company_assignments
  FOR SELECT USING ((select is_module_admin('regulatory')) OR consultant_id = (select auth.uid()));

DROP POLICY IF EXISTS "assignments_insert" ON regulatory.consultant_company_assignments;
CREATE POLICY "assignments_insert" ON regulatory.consultant_company_assignments
  FOR INSERT WITH CHECK ((select is_module_admin('regulatory')));

DROP POLICY IF EXISTS "assignments_update" ON regulatory.consultant_company_assignments;
CREATE POLICY "assignments_update" ON regulatory.consultant_company_assignments
  FOR UPDATE USING ((select is_module_admin('regulatory')));

DROP POLICY IF EXISTS "assignments_delete" ON regulatory.consultant_company_assignments;
CREATE POLICY "assignments_delete" ON regulatory.consultant_company_assignments
  FOR DELETE USING ((select is_module_admin('regulatory')));

-- ─── regulatory.consultations ──────────────────────────────────────────────────

DROP POLICY IF EXISTS "consultations_select" ON regulatory.consultations;
CREATE POLICY "consultations_select" ON regulatory.consultations
  FOR SELECT USING ((select is_module_admin('regulatory')) OR has_company_access(company_id));

DROP POLICY IF EXISTS "consultations_insert" ON regulatory.consultations;
CREATE POLICY "consultations_insert" ON regulatory.consultations
  FOR INSERT WITH CHECK ((select is_module_admin('regulatory')) OR has_company_access(company_id));

DROP POLICY IF EXISTS "consultations_update" ON regulatory.consultations;
CREATE POLICY "consultations_update" ON regulatory.consultations
  FOR UPDATE USING ((select is_module_admin('regulatory')) OR has_company_access(company_id));

-- ─── regulatory.chemicals ───────────────────────────────────────────────────────

DROP POLICY IF EXISTS "chemicals_select" ON regulatory.chemicals;
CREATE POLICY "chemicals_select" ON regulatory.chemicals
  FOR SELECT USING ((select has_module_access('regulatory')));

DROP POLICY IF EXISTS "chemicals_insert" ON regulatory.chemicals;
CREATE POLICY "chemicals_insert" ON regulatory.chemicals
  FOR INSERT WITH CHECK ((select has_module_access('regulatory')));

DROP POLICY IF EXISTS "chemicals_update" ON regulatory.chemicals;
CREATE POLICY "chemicals_update" ON regulatory.chemicals
  FOR UPDATE USING ((select has_module_access('regulatory')));

-- ─── regulatory.chemical_aliases ────────────────────────────────────────────────

DROP POLICY IF EXISTS "aliases_select" ON regulatory.chemical_aliases;
CREATE POLICY "aliases_select" ON regulatory.chemical_aliases
  FOR SELECT USING ((select has_module_access('regulatory')));

DROP POLICY IF EXISTS "aliases_insert" ON regulatory.chemical_aliases;
CREATE POLICY "aliases_insert" ON regulatory.chemical_aliases
  FOR INSERT WITH CHECK ((select has_module_access('regulatory')));

-- ─── regulatory.consultation_chemicals ──────────────────────────────────────────

DROP POLICY IF EXISTS "cc_select" ON regulatory.consultation_chemicals;
CREATE POLICY "cc_select" ON regulatory.consultation_chemicals
  FOR SELECT USING (
    (select is_module_admin('regulatory')) OR EXISTS (
      SELECT 1 FROM regulatory.consultations c
      WHERE c.id = consultation_id AND has_company_access(c.company_id)
    )
  );

DROP POLICY IF EXISTS "cc_insert" ON regulatory.consultation_chemicals;
CREATE POLICY "cc_insert" ON regulatory.consultation_chemicals
  FOR INSERT WITH CHECK (
    (select is_module_admin('regulatory')) OR EXISTS (
      SELECT 1 FROM regulatory.consultations c
      WHERE c.id = consultation_id AND has_company_access(c.company_id)
    )
  );

DROP POLICY IF EXISTS "cc_delete" ON regulatory.consultation_chemicals;
CREATE POLICY "cc_delete" ON regulatory.consultation_chemicals
  FOR DELETE USING (
    (select is_module_admin('regulatory')) OR EXISTS (
      SELECT 1 FROM regulatory.consultations c
      WHERE c.id = consultation_id AND has_company_access(c.company_id)
    )
  );

-- ─── regulatory.regulatory_listings ─────────────────────────────────────────────

DROP POLICY IF EXISTS "reg_listings_select" ON regulatory.regulatory_listings;
CREATE POLICY "reg_listings_select" ON regulatory.regulatory_listings
  FOR SELECT USING ((select has_module_access('regulatory')));

DROP POLICY IF EXISTS "reg_listings_insert" ON regulatory.regulatory_listings;
CREATE POLICY "reg_listings_insert" ON regulatory.regulatory_listings
  FOR INSERT WITH CHECK ((select has_module_access('regulatory')));

DROP POLICY IF EXISTS "reg_listings_update" ON regulatory.regulatory_listings;
CREATE POLICY "reg_listings_update" ON regulatory.regulatory_listings
  FOR UPDATE USING ((select has_module_access('regulatory')));

-- ─── regulatory.consultation_consultants ──────────────────────────────────────

DROP POLICY IF EXISTS "cc_consultants_select" ON regulatory.consultation_consultants;
CREATE POLICY "cc_consultants_select" ON regulatory.consultation_consultants
  FOR SELECT USING ((select is_module_admin('regulatory')) OR consultant_id = (select auth.uid()));

DROP POLICY IF EXISTS "cc_consultants_insert" ON regulatory.consultation_consultants;
CREATE POLICY "cc_consultants_insert" ON regulatory.consultation_consultants
  FOR INSERT WITH CHECK ((select is_module_admin('regulatory')));

DROP POLICY IF EXISTS "cc_consultants_delete" ON regulatory.consultation_consultants;
CREATE POLICY "cc_consultants_delete" ON regulatory.consultation_consultants
  FOR DELETE USING ((select is_module_admin('regulatory')));

-- ─── regulatory.consultation_logs ──────────────────────────────────────────────

DROP POLICY IF EXISTS "logs_select" ON regulatory.consultation_logs;
CREATE POLICY "logs_select" ON regulatory.consultation_logs
  FOR SELECT USING (
    (SELECT role FROM public.profiles WHERE id = (select auth.uid())) = 'super_admin'
    OR (select is_module_admin('regulatory'))
    OR EXISTS (
      SELECT 1 FROM regulatory.consultation_consultants
      WHERE consultation_id = consultation_logs.consultation_id
        AND consultant_id   = (select auth.uid())
    )
  );

-- ─── regulatory.consultation_products ───────────────────────────────────────────

DROP POLICY IF EXISTS "Regulatory members can manage products" ON regulatory.consultation_products;
CREATE POLICY "Regulatory members can manage products" ON regulatory.consultation_products
  USING (
    EXISTS (
      SELECT 1
      FROM   regulatory.consultations c
      WHERE  c.id = consultation_id
      AND    (select has_module_access('regulatory'))
    )
  );

-- ─── recruitment.* ───────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS recruitment_module_access ON recruitment.candidates;
CREATE POLICY recruitment_module_access ON recruitment.candidates
  FOR ALL TO authenticated USING ((select has_module_access('recruitment')));

DROP POLICY IF EXISTS recruitment_module_access ON recruitment.jobs;
CREATE POLICY recruitment_module_access ON recruitment.jobs
  FOR ALL TO authenticated USING ((select has_module_access('recruitment')));

DROP POLICY IF EXISTS recruitment_module_access ON recruitment.job_events;
CREATE POLICY recruitment_module_access ON recruitment.job_events
  FOR ALL TO authenticated USING ((select has_module_access('recruitment')));

DROP POLICY IF EXISTS recruitment_module_access ON recruitment.applications;
CREATE POLICY recruitment_module_access ON recruitment.applications
  FOR ALL TO authenticated USING ((select has_module_access('recruitment')));

DROP POLICY IF EXISTS recruitment_module_access ON recruitment.application_stage_history;
CREATE POLICY recruitment_module_access ON recruitment.application_stage_history
  FOR ALL TO authenticated USING ((select has_module_access('recruitment')));

DROP POLICY IF EXISTS recruitment_module_access ON recruitment.placements;
CREATE POLICY recruitment_module_access ON recruitment.placements
  FOR ALL TO authenticated USING ((select has_module_access('recruitment')));

DROP POLICY IF EXISTS recruitment_module_access ON recruitment.tasks;
CREATE POLICY recruitment_module_access ON recruitment.tasks
  FOR ALL TO authenticated USING ((select has_module_access('recruitment')));

-- ─── crm.opportunities ───────────────────────────────────────────────────────────

DROP POLICY IF EXISTS opportunities_crm_access ON crm.opportunities;
CREATE POLICY opportunities_crm_access ON crm.opportunities
  FOR ALL TO authenticated USING ((select has_module_access('crm')));

-- ─── public.allowed_email_domains ───────────────────────────────────────────────

DROP POLICY IF EXISTS "domains_insert" ON public.allowed_email_domains;
CREATE POLICY "domains_insert" ON public.allowed_email_domains
  FOR INSERT WITH CHECK ((select is_admin()));

DROP POLICY IF EXISTS "domains_delete" ON public.allowed_email_domains;
CREATE POLICY "domains_delete" ON public.allowed_email_domains
  FOR DELETE USING ((select is_admin()));
