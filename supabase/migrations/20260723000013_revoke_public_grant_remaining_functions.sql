-- ─────────────────────────────────────────────────────────────────────────────
-- Follow-up correction to 20260723000012: that migration revoked anon's and
-- authenticated's *direct* EXECUTE grants on these 4 functions, but never
-- revoked the separate PUBLIC-level grant they also each had (unlike the
-- other 7 functions in 000012, which already had PUBLIC revoked back in
-- 000007/000008). Since every role implicitly inherits from PUBLIC, the
-- surviving PUBLIC grant alone kept anon/authenticated able to execute these
-- — verified via get_advisors still flagging all 4 after 000012, then
-- confirmed directly against pg_proc.proacl that PUBLIC ("-" grantee) was
-- the only remaining grantee besides postgres/service_role.
-- Migration: 20260723000013_revoke_public_grant_remaining_functions.sql
-- ─────────────────────────────────────────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.grant_default_module_access() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_super_admin_group() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
