-- ─────────────────────────────────────────────────────────────────────────────
-- Split "delete applications" out from "recruitment.applications.edit" into its
-- own permission key, so it can be granted/revoked independently. Backfill
-- every group that currently holds edit with the new delete key so nobody's
-- existing delete access silently regresses — it becomes independently
-- revocable from this point forward instead of bundled with edit.
--
-- The locked "Super Admin" group grants no permissions of its own (see
-- 20260722000001_locked_super_admin_group.sql), so it never matches the
-- WHERE clause below and the locked-group-permission trigger is never hit.
-- Migration: 20260813000001_recruitment_applications_delete_permission.sql
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.user_group_permissions (group_id, permission_key)
SELECT group_id, 'recruitment.applications.delete'
FROM public.user_group_permissions
WHERE permission_key = 'recruitment.applications.edit'
ON CONFLICT (group_id, permission_key) DO NOTHING;
