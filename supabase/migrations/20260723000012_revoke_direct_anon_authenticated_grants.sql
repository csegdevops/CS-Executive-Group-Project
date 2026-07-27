-- ─────────────────────────────────────────────────────────────────────────────
-- Correction to 20260723000007/000008: REVOKE ... FROM PUBLIC only removes
-- the blanket "everyone" grant — it does NOT touch grants made directly to a
-- named role. This Supabase project's `public` schema has default privileges
-- that grant EXECUTE directly to anon AND authenticated on every new
-- function (separate from PUBLIC), so those two migrations' REVOKEs were
-- incomplete: verified via get_advisors that anon/authenticated could still
-- execute all of these. This migration revokes the actual direct grants.
--
-- Also covers three functions discovered live (not part of any migration in
-- this repo, so not caught by the earlier audit): handle_new_user(),
-- grant_default_module_access(), sync_super_admin_group() are trigger
-- functions (RETURNS trigger) and rls_auto_enable() is a Supabase-owned
-- event trigger function (RETURNS event_trigger, owner postgres). None of
-- the four can actually be invoked via a plain SELECT/RPC call — Postgres
-- rejects direct calls to trigger/event-trigger-returning functions outside
-- their trigger context — so this only silences the advisory, it doesn't
-- change any real code path.
-- Migration: 20260723000012_revoke_direct_anon_authenticated_grants.sql
-- ─────────────────────────────────────────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_module_admin(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_module_access(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_company_access(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_lookup(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.search_chemicals(text[]) FROM anon;

REVOKE EXECUTE ON FUNCTION public.match_chemicals_by_names(text[]) FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.grant_default_module_access() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_super_admin_group() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated;
