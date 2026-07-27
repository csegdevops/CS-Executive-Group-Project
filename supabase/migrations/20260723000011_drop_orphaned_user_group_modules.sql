-- ─────────────────────────────────────────────────────────────────────────────
-- public.user_group_modules (group_id, module, access_level) is orphaned:
-- it appears in no migration file in this repo and is referenced nowhere in
-- src/. Its 6 rows map the same seed groups from
-- 20260721000001_user_groups.sql (Regulatory/Recruitment/CRM Admin/Member)
-- to a (module, access_level) pair — almost certainly a leftover from an
-- earlier, pre-permission-key iteration of the groups schema, superseded by
-- user_group_permissions. Confirmed no other object depends on it (its only
-- constraint is an outgoing FK to user_groups; nothing references into it).
-- Migration: 20260723000011_drop_orphaned_user_group_modules.sql
-- ─────────────────────────────────────────────────────────────────────────────

DROP TABLE IF EXISTS public.user_group_modules;
