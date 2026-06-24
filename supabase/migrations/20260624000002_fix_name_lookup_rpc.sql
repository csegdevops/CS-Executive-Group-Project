-- The original match_chemicals_by_names only searched chemical_aliases.
-- Chemicals imported via AICIS or matched by CAS never get alias rows written,
-- so a name-only lookup (no CAS provided) would miss them.
-- Fix: union in a direct common_name match as a fallback.

create or replace function public.match_chemicals_by_names(names text[])
returns table (input_name text, chemical_id uuid, common_name text, cas_number text)
language sql
stable
security definer
set search_path = regulatory, public
as $$
  -- Primary: exact alias match
  select ca.alias   as input_name,
         c.id       as chemical_id,
         c.common_name,
         c.cas_number
  from   regulatory.chemical_aliases ca
  join   regulatory.chemicals        c on c.id = ca.chemical_id
  where  lower(ca.alias) = any(select lower(n) from unnest(names) as t(n))

  union

  -- Fallback: match on common_name for chemicals that have no alias rows yet
  select c.common_name as input_name,
         c.id          as chemical_id,
         c.common_name,
         c.cas_number
  from   regulatory.chemicals c
  where  lower(c.common_name) = any(select lower(n) from unnest(names) as t(n))
$$;
