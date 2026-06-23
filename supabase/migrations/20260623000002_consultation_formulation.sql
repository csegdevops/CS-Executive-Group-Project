-- Formulation-specific fields on the junction table.
-- product_name: which formulation this ingredient belongs to (clients submit multiple products).
-- alt_cas: alternative CAS from the client's data, stored for traceability.
-- concentration maps to the existing quantity + unit fields; function maps to role.
alter table regulatory.consultation_chemicals
  add column if not exists product_name text,
  add column if not exists alt_cas      text;

-- Per-product import volume inputs.
-- Units/year and unit size are shared by all ingredients of the same product, so they live here
-- rather than being duplicated on every consultation_chemicals row.
create table if not exists regulatory.consultation_products (
  id              uuid        primary key default gen_random_uuid(),
  consultation_id uuid        not null references regulatory.consultations(id) on delete cascade,
  product_name    text        not null,
  units_per_year  numeric,
  unit_size_grams numeric,
  created_at      timestamptz default now(),
  unique(consultation_id, product_name)
);

alter table regulatory.consultation_products enable row level security;

create policy "Regulatory members can manage products"
  on regulatory.consultation_products
  using (
    exists (
      select 1
      from   regulatory.consultations c
      join   public.profiles p on p.id = auth.uid()
      where  c.id = consultation_id
      and    (
        p.role = 'super_admin'
        or exists (
          select 1 from public.user_module_access
          where  user_id     = auth.uid()
          and    module       = 'regulatory'
          and    access_level in ('admin', 'member')
        )
      )
    )
  );
