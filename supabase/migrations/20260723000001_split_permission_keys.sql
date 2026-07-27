-- ─────────────────────────────────────────────────────────────────────────────
-- Split coarse permission keys into finer-grained ones so security groups can
-- grant/revoke by actual route boundary instead of an all-or-nothing bundle.
-- Every group's existing effective access is preserved by backfilling the
-- new keys onto any group that currently holds the old one, then dropping
-- the old key.
-- Migration: 20260723000001_split_permission_keys.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── regulatory.consultations.edit → edit_details / chemicals / volumes / upload ─

INSERT INTO public.user_group_permissions (group_id, permission_key)
SELECT group_id, key
FROM public.user_group_permissions, unnest(ARRAY[
  'regulatory.consultations.edit_details',
  'regulatory.consultations.chemicals',
  'regulatory.consultations.volumes',
  'regulatory.consultations.upload'
]) AS key
WHERE permission_key = 'regulatory.consultations.edit'
ON CONFLICT (group_id, permission_key) DO NOTHING;

-- regulatory.consultations.notes replaces a bug where notes were gated on
-- bare module access, not an edit-level permission — backfill onto every
-- group that currently holds regulatory.access so behavior doesn't change.
INSERT INTO public.user_group_permissions (group_id, permission_key)
SELECT group_id, 'regulatory.consultations.notes'
FROM public.user_group_permissions
WHERE permission_key = 'regulatory.access'
ON CONFLICT (group_id, permission_key) DO NOTHING;

DELETE FROM public.user_group_permissions WHERE permission_key = 'regulatory.consultations.edit';

-- ─── regulatory.chemicals.manage → also grants regulatory_status ─────────────

INSERT INTO public.user_group_permissions (group_id, permission_key)
SELECT group_id, 'regulatory.chemicals.regulatory_status'
FROM public.user_group_permissions
WHERE permission_key = 'regulatory.chemicals.manage'
ON CONFLICT (group_id, permission_key) DO NOTHING;

-- ─── companies.manage → create / edit / contacts.manage / branches.manage ────

INSERT INTO public.user_group_permissions (group_id, permission_key)
SELECT group_id, key
FROM public.user_group_permissions, unnest(ARRAY[
  'companies.create',
  'companies.edit',
  'companies.contacts.manage',
  'companies.branches.manage'
]) AS key
WHERE permission_key = 'companies.manage'
ON CONFLICT (group_id, permission_key) DO NOTHING;

DELETE FROM public.user_group_permissions WHERE permission_key = 'companies.manage';
