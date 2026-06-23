create table regulatory.consultation_logs (
  id              uuid        primary key default gen_random_uuid(),
  consultation_id uuid        not null references regulatory.consultations(id) on delete cascade,
  user_id         uuid        not null references public.profiles(id),
  action          text        not null,
  details         jsonb,
  created_at      timestamptz default now()
);

create index on regulatory.consultation_logs(consultation_id, created_at desc);

alter table regulatory.consultation_logs enable row level security;

create policy "logs_select" on regulatory.consultation_logs
  for select using (
    (select role from public.profiles where id = auth.uid()) = 'super_admin'
    or exists (
      select 1 from public.user_module_access
      where user_id = auth.uid() and module = 'regulatory' and access_level = 'admin'
    )
    or exists (
      select 1 from regulatory.consultation_consultants
      where consultation_id = consultation_logs.consultation_id
        and consultant_id   = auth.uid()
    )
  );
