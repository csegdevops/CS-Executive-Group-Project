-- Consultants assigned to a specific consultation (regulatory.consultation_consultants)
-- could not actually view or edit it unless they *also* had a company-level
-- assignment (regulatory.consultant_company_assignments) — a separate table.
-- POST /api/consultations auto-adds the creator to consultation_consultants
-- but never grants a company-level assignment, so creators (and anyone else
-- assigned per-consultation) hit RLS-driven 404s / empty data.
-- Widen consultations + consultation_chemicals access to also allow the
-- consultation_consultants membership path, mirroring the pattern already
-- used by consultation_logs' logs_select policy.

drop policy if exists consultations_select on regulatory.consultations;
create policy consultations_select on regulatory.consultations
for select
using (
  is_module_admin('regulatory')
  or has_company_access(company_id)
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
  or has_company_access(company_id)
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
    select 1 from regulatory.consultations c
    where c.id = consultation_chemicals.consultation_id
      and has_company_access(c.company_id)
  )
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
    select 1 from regulatory.consultations c
    where c.id = consultation_chemicals.consultation_id
      and has_company_access(c.company_id)
  )
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
    select 1 from regulatory.consultations c
    where c.id = consultation_chemicals.consultation_id
      and has_company_access(c.company_id)
  )
  or exists (
    select 1 from regulatory.consultation_consultants cc
    where cc.consultation_id = consultation_chemicals.consultation_id
      and cc.consultant_id = auth.uid()
  )
);
