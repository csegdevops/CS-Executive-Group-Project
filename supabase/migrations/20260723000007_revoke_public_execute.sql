-- ─────────────────────────────────────────────────────────────────────────────
-- Supabase advisor: SECURITY DEFINER functions in an exposed schema are
-- callable directly via PostgREST RPC (e.g. /rest/v1/rpc/can_manage_lookup)
-- using whatever EXECUTE grant they hold — Postgres defaults new functions to
-- EXECUTE granted to PUBLIC (every role, including anon), regardless of how
-- the app actually intends to call them. This locks each function down to
-- only the roles verified (by grepping every .rpc() call site in src/) to
-- actually need it:
--   - can_manage_lookup / search_chemicals: called via the session client
--     (authenticated role) — also used inside RLS policies evaluated as
--     authenticated, which still needs direct EXECUTE regardless of RPC path.
--   - match_chemicals_by_names / recruitment.upsert_candidate: called only
--     via the admin (service_role) client in every call site — never reached
--     by anon or authenticated, so locked to service_role only.
--   - recruitment.search_candidates: called via the session client
--     (authenticated role).
--
-- Deliberately NOT touched here: is_admin() / is_module_admin(text) /
-- has_module_access(text) / has_company_access(uuid). These are the same
-- class of issue, but several RLS policies that call them (profiles_select,
-- companies_select, consultations_select, chemicals_select, etc.) have no
-- `TO authenticated` restriction, so revoking anon's EXECUTE would turn
-- anon's current (silently-empty) queries against those tables into hard
-- "permission denied for function" errors instead — a behavior change that
-- needs a decision on the intended anon-access model first, not a silent fix.
-- Migration: 20260723000007_revoke_public_execute.sql
-- ─────────────────────────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.can_manage_lookup(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_lookup(text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.search_chemicals(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_chemicals(text[]) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.match_chemicals_by_names(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_chemicals_by_names(text[]) TO service_role;

REVOKE ALL ON FUNCTION recruitment.upsert_candidate(
  text, text, text, text, text, text, text, text, text, text, jsonb, text[], text, text, uuid
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION recruitment.upsert_candidate(
  text, text, text, text, text, text, text, text, text, text, jsonb, text[], text, text, uuid
) TO service_role;

REVOKE ALL ON FUNCTION recruitment.search_candidates(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION recruitment.search_candidates(text, integer) TO authenticated, service_role;
