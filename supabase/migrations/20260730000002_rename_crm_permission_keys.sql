-- ─────────────────────────────────────────────────────────────────────────────
-- Rename crm.* permission keys to recruitment.* (part of the CRM/Recruitment
-- module merge). Pure namespace rename — no group membership or capability
-- changes; insert-then-delete (not UPDATE) to survive UNIQUE(group_id,
-- permission_key) if a group somehow already holds both.
-- Migration: 20260730000002_rename_crm_permission_keys.sql
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.user_group_permissions (group_id, permission_key)
SELECT group_id, 'recruitment.access' FROM public.user_group_permissions WHERE permission_key = 'crm.access'
ON CONFLICT (group_id, permission_key) DO NOTHING;
DELETE FROM public.user_group_permissions WHERE permission_key = 'crm.access';

INSERT INTO public.user_group_permissions (group_id, permission_key)
SELECT group_id, 'recruitment.opportunities.create' FROM public.user_group_permissions WHERE permission_key = 'crm.opportunities.create'
ON CONFLICT (group_id, permission_key) DO NOTHING;
DELETE FROM public.user_group_permissions WHERE permission_key = 'crm.opportunities.create';

INSERT INTO public.user_group_permissions (group_id, permission_key)
SELECT group_id, 'recruitment.opportunities.edit' FROM public.user_group_permissions WHERE permission_key = 'crm.opportunities.edit'
ON CONFLICT (group_id, permission_key) DO NOTHING;
DELETE FROM public.user_group_permissions WHERE permission_key = 'crm.opportunities.edit';

INSERT INTO public.user_group_permissions (group_id, permission_key)
SELECT group_id, 'recruitment.reference_data.manage' FROM public.user_group_permissions WHERE permission_key = 'crm.reference_data.manage'
ON CONFLICT (group_id, permission_key) DO NOTHING;
DELETE FROM public.user_group_permissions WHERE permission_key = 'crm.reference_data.manage';
