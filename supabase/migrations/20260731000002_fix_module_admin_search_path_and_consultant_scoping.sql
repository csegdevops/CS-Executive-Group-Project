-- Two fixes:
--
-- 1) Real bug: 20260723000005_function_search_path.sql pinned search_path='' on
--    is_module_admin(text) and has_module_access(text) for security hardening,
--    but both bodies call is_admin() UNQUALIFIED. With an empty search_path,
--    Postgres cannot resolve the bare name at plan time — is_module_admin()/
--    has_module_access() have thrown "function is_admin() does not exist" on
--    EVERY invocation since that migration landed (verified: `select
--    is_module_admin('regulatory')` errors unconditionally, regardless of
--    caller/role). Since these two functions back most regulatory RLS SELECT
--    policies (and consultation_products, chemicals, etc.), every read routed
--    through the RLS-enforced client has been silently failing — this is the
--    actual cause of "consultation gives 404": the page's `.single()` call
--    errors, data comes back null/undefined, and the page calls notFound().
--    Fix: schema-qualify the call.
--
-- 2) Product decision: consultants are assigned per-consultation
--    (regulatory.consultation_consultants), not per-company
--    (regulatory.consultant_company_assignments — that table is unused/empty
--    in practice). Drop the company-level access path from consultations and
--    consultation_chemicals policies so a non-admin consultant's access is
--    governed solely by whether they're assigned to that specific
--    consultation, matching how POST /api/consultations already auto-assigns
--    the creator via consultation_consultants.

create or replace function public.is_module_admin(mod text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1
    from public.user_group_members m
    join public.user_group_permissions p on p.group_id = m.group_id
    where m.user_id = auth.uid()
      and p.permission_key like mod || '.%'
      and p.permission_key <> mod || '.access'
  ) or public.is_admin()
$function$;

create or replace function public.has_module_access(mod text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1
    from public.user_group_members m
    join public.user_group_permissions p on p.group_id = m.group_id
    where m.user_id = auth.uid() and p.permission_key like mod || '.%'
  ) or public.is_admin()
$function$;

drop policy if exists consultations_select on regulatory.consultations;
create policy consultations_select on regulatory.consultations
for select
using (
  is_module_admin('regulatory')
  or exists (
    select 1 from regulatory.consultation_consultants cc
    where cc.consultation_id = consultations.id
      and cc.consultant_id = auth.uid()
  )
);

drop policy if exists consultations_update on regulatory.consultations;
create policy consultations_update on regulatory.consultations
for update
using (
  is_module_admin('regulatory')
  or exists (
    select 1 from regulatory.consultation_consultants cc
    where cc.consultation_id = consultations.id
      and cc.consultant_id = auth.uid()
  )
);

drop policy if exists cc_select on regulatory.consultation_chemicals;
create policy cc_select on regulatory.consultation_chemicals
for select
using (
  is_module_admin('regulatory')
  or exists (
    select 1 from regulatory.consultation_consultants cc
    where cc.consultation_id = consultation_chemicals.consultation_id
      and cc.consultant_id = auth.uid()
  )
);

drop policy if exists cc_insert on regulatory.consultation_chemicals;
create policy cc_insert on regulatory.consultation_chemicals
for insert
with check (
  is_module_admin('regulatory')
  or exists (
    select 1 from regulatory.consultation_consultants cc
    where cc.consultation_id = consultation_chemicals.consultation_id
      and cc.consultant_id = auth.uid()
  )
);

drop policy if exists cc_delete on regulatory.consultation_chemicals;
create policy cc_delete on regulatory.consultation_chemicals
for delete
using (
  is_module_admin('regulatory')
  or exists (
    select 1 from regulatory.consultation_consultants cc
    where cc.consultation_id = consultation_chemicals.consultation_id
      and cc.consultant_id = auth.uid()
  )
);
