-- ─────────────────────────────────────────────────────────────────────────────
-- Supabase advisor: functions without a fixed search_path are vulnerable to
-- schema-shadowing (a malicious object earlier in a mutable search_path could
-- hijack an unqualified reference at call time). Every function below already
-- fully schema-qualifies its table/function references, so pinning
-- search_path to '' (empty — only pg_catalog/pg_temp remain implicit) is a
-- pure hardening change with no behavior difference.
-- Migration: 20260723000005_function_search_path.sql
-- ─────────────────────────────────────────────────────────────────────────────

ALTER FUNCTION public.is_admin() SET search_path = '';
ALTER FUNCTION public.is_module_admin(text) SET search_path = '';
ALTER FUNCTION public.has_module_access(text) SET search_path = '';
ALTER FUNCTION public.has_company_access(uuid) SET search_path = '';
ALTER FUNCTION public.handle_new_user() SET search_path = '';
ALTER FUNCTION public.grant_default_module_access() SET search_path = '';
ALTER FUNCTION public.set_updated_at() SET search_path = '';
ALTER FUNCTION public.update_company_last_activity() SET search_path = '';
ALTER FUNCTION public.sync_super_admin_group() SET search_path = '';
ALTER FUNCTION public.prevent_locked_group_mutation() SET search_path = '';
ALTER FUNCTION public.prevent_locked_group_permission_mutation() SET search_path = '';

-- recruitment.log_application_stage_change() is intentionally omitted: it
-- doesn't exist in the live database (pre-existing drift, unrelated to this
-- migration — discovered while applying this file; the BR-007 auto-logging
-- trigger it should back is also missing). Tracked separately, not fixed here.
ALTER FUNCTION recruitment.create_placement_tasks() SET search_path = '';
ALTER FUNCTION recruitment.compute_candidate_completeness() SET search_path = '';
