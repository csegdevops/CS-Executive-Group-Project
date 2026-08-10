-- New grouped permission: recruitment.contracts.edit_dates — lets recruiters
-- correct a contract's start/finish date directly, without the broader
-- recruitment.contracts.manage permission (extend/renew/terminate/documents).
-- Registered in src/lib/permissions.ts's PERMISSION_CATALOG so it shows up
-- as a normal toggleable checkbox in the Security Groups admin UI
-- (src/app/(portal)/admin/settings/groups/[groupId]) — granted here to both
-- Recruitment groups so it actually works for recruiters immediately
-- (recruitment.contracts.manage itself was never seeded to any group, so
-- this mirrors what "recruiters can edit it" needs to be true today).
-- Migration: 20260810000008_contract_edit_dates_permission.sql

INSERT INTO public.user_group_permissions (group_id, permission_key)
SELECT id, 'recruitment.contracts.edit_dates'
FROM public.user_groups
WHERE name IN ('Recruitment Admin', 'Recruitment Member')
ON CONFLICT (group_id, permission_key) DO NOTHING;
