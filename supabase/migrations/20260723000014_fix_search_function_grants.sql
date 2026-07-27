-- ─────────────────────────────────────────────────────────────────────────────
-- Correction: search_candidates is only ever called via the admin/service-role
-- client (recruitment/candidates/route.ts uses
-- admin.schema("recruitment").rpc(...), not the session client) -- the
-- authenticated grant added in 20260723000007/000008 was based on a misread
-- of the call site and was never actually needed.
--
-- search_chemicals only queries regulatory.chemicals/chemical_aliases, both
-- of which authenticated already has direct table grants on and both of
-- which now carry correct `TO authenticated` RLS requiring
-- has_module_access('regulatory'). SECURITY DEFINER was bypassing that RLS
-- entirely for this one RPC path (the plain listing path in the same route
-- was already correctly RLS-gated) -- switching to SECURITY INVOKER closes
-- that inconsistency and also fully clears the advisory for this function.
-- Migration: 20260723000014_fix_search_function_grants.sql
-- ─────────────────────────────────────────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION recruitment.search_candidates(text, integer) FROM authenticated;

ALTER FUNCTION public.search_chemicals(text[]) SECURITY INVOKER;
