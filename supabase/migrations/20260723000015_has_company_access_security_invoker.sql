-- ─────────────────────────────────────────────────────────────────────────────
-- authenticated already has a direct table grant on
-- regulatory.consultant_company_assignments, and every call site
-- (companies_select, consultations_select/insert/update, cc_select/insert/
-- delete) only evaluates has_company_access() when is_module_admin() is
-- false -- at which point the function's own `consultant_id = auth.uid()`
-- filter already satisfies that table's RLS (assignments_select:
-- is_module_admin('regulatory') OR consultant_id = auth.uid()). Switching to
-- SECURITY INVOKER doesn't change any result, just closes the advisory.
-- Migration: 20260723000015_has_company_access_security_invoker.sql
-- ─────────────────────────────────────────────────────────────────────────────

ALTER FUNCTION public.has_company_access(uuid) SECURITY INVOKER;
