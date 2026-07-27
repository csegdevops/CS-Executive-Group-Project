-- ─────────────────────────────────────────────────────────────────────────────
-- Every policy below calls is_admin() / is_module_admin(text) /
-- has_module_access(text) / has_company_access(uuid) with no `TO` restriction,
-- meaning it applies to every role, anon included. Scoping them to
-- `authenticated` means Postgres skips evaluating the policy entirely for
-- anon (rather than evaluating it and hitting a function-permission check),
-- which is what makes it safe to then revoke anon's EXECUTE on those 4
-- functions below — closing the "callable via /rest/v1/rpc/is_admin (etc.)
-- by anon" advisory without turning any current anon table access into a
-- hard error, because anon no longer reaches these policies (or these
-- functions) at all.
--
-- ALTER POLICY ... TO authenticated changes only the role list; the USING/
-- WITH CHECK expressions are untouched, so this carries no logic risk.
-- Migration: 20260723000008_restrict_policies_to_authenticated.sql
-- ─────────────────────────────────────────────────────────────────────────────

ALTER POLICY "profiles_select" ON public.profiles TO authenticated;
ALTER POLICY "profiles_update" ON public.profiles TO authenticated;

ALTER POLICY "companies_select" ON public.companies TO authenticated;
ALTER POLICY "companies_insert" ON public.companies TO authenticated;
ALTER POLICY "companies_update" ON public.companies TO authenticated;

ALTER POLICY "assignments_select" ON regulatory.consultant_company_assignments TO authenticated;
ALTER POLICY "assignments_insert" ON regulatory.consultant_company_assignments TO authenticated;
ALTER POLICY "assignments_update" ON regulatory.consultant_company_assignments TO authenticated;
ALTER POLICY "assignments_delete" ON regulatory.consultant_company_assignments TO authenticated;

ALTER POLICY "consultations_select" ON regulatory.consultations TO authenticated;
ALTER POLICY "consultations_insert" ON regulatory.consultations TO authenticated;
ALTER POLICY "consultations_update" ON regulatory.consultations TO authenticated;

ALTER POLICY "chemicals_select" ON regulatory.chemicals TO authenticated;
ALTER POLICY "chemicals_insert" ON regulatory.chemicals TO authenticated;
ALTER POLICY "chemicals_update" ON regulatory.chemicals TO authenticated;

ALTER POLICY "aliases_select" ON regulatory.chemical_aliases TO authenticated;
ALTER POLICY "aliases_insert" ON regulatory.chemical_aliases TO authenticated;

ALTER POLICY "cc_select" ON regulatory.consultation_chemicals TO authenticated;
ALTER POLICY "cc_insert" ON regulatory.consultation_chemicals TO authenticated;
ALTER POLICY "cc_delete" ON regulatory.consultation_chemicals TO authenticated;

ALTER POLICY "reg_listings_select" ON regulatory.regulatory_listings TO authenticated;
ALTER POLICY "reg_listings_insert" ON regulatory.regulatory_listings TO authenticated;
ALTER POLICY "reg_listings_update" ON regulatory.regulatory_listings TO authenticated;

ALTER POLICY "cc_consultants_select" ON regulatory.consultation_consultants TO authenticated;
ALTER POLICY "cc_consultants_insert" ON regulatory.consultation_consultants TO authenticated;
ALTER POLICY "cc_consultants_delete" ON regulatory.consultation_consultants TO authenticated;

ALTER POLICY "logs_select" ON regulatory.consultation_logs TO authenticated;

ALTER POLICY "Regulatory members can manage products" ON regulatory.consultation_products TO authenticated;

ALTER POLICY "domains_insert" ON public.allowed_email_domains TO authenticated;
ALTER POLICY "domains_delete" ON public.allowed_email_domains TO authenticated;

-- ─── Now safe to close the anon RPC-exposure hole ───────────────────────────────

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_module_admin(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_module_admin(text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.has_module_access(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_module_access(text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.has_company_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_company_access(uuid) TO authenticated, service_role;
