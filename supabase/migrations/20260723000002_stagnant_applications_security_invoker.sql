-- ─────────────────────────────────────────────────────────────────────────────
-- recruitment.v_stagnant_applications was created without security_invoker,
-- so its underlying RLS policies (has_module_access('recruitment') on
-- applications/jobs/candidates) evaluate against the view's owner rather
-- than the querying user — any authenticated user can SELECT the view via
-- the schema-wide grant, so this let anyone read stagnant-application data
-- regardless of recruitment module access. security_invoker makes the view
-- run with the querying user's own RLS, closing that gap.
-- Migration: 20260723000002_stagnant_applications_security_invoker.sql
-- ─────────────────────────────────────────────────────────────────────────────

ALTER VIEW recruitment.v_stagnant_applications SET (security_invoker = on);
