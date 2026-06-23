-- Enable trigram extension for fast ILIKE wildcard search (no-op if already enabled)
create extension if not exists pg_trgm;

-- GIN trigram indexes on chemical name fields — makes %word% ILIKE queries use an index
-- instead of scanning the full table. PostgreSQL's query planner picks these up automatically.
create index if not exists idx_chemicals_common_name_trgm
  on regulatory.chemicals using gin (common_name gin_trgm_ops);

create index if not exists idx_chemicals_cas_number_trgm
  on regulatory.chemicals using gin (cas_number gin_trgm_ops);

create index if not exists idx_chemicals_iupac_name_trgm
  on regulatory.chemicals using gin (iupac_name gin_trgm_ops);

-- Alias table: GIN index alongside existing B-tree (B-tree kept for exact prefix lookups)
create index if not exists idx_chemical_aliases_alias_trgm
  on regulatory.chemical_aliases using gin (lower(alias) gin_trgm_ops);

-- Multi-keyword chemical search. Each word in query_words must appear somewhere in the
-- chemical's name fields (common_name, cas_number, iupac_name) or any of its aliases.
-- bool_and() enforces AND across words; ilike() handles case-insensitive substring matching.
-- Using RPC avoids all PostgREST filter-syntax edge cases with complex multi-word AND+OR logic.
create or replace function public.search_chemicals(query_words text[])
returns table (
  id               uuid,
  cas_number       text,
  common_name      text,
  iupac_name       text,
  molecular_formula text,
  needs_review     boolean
)
language sql
stable
security definer
set search_path = regulatory, public
as $$
  select distinct
         c.id, c.cas_number, c.common_name, c.iupac_name, c.molecular_formula, c.needs_review
  from   regulatory.chemicals c
  where  (
           select bool_and(
                    c.common_name              ilike ('%' || word || '%')
                 or coalesce(c.cas_number, '') ilike ('%' || word || '%')
                 or coalesce(c.iupac_name, '') ilike ('%' || word || '%')
                 or exists (
                      select 1
                      from   regulatory.chemical_aliases ca
                      where  ca.chemical_id = c.id
                      and    ca.alias        ilike ('%' || word || '%')
                    )
                  )
           from   unnest(query_words) as t(word)
         )
  order by c.common_name
  limit  40
$$;

-- Batch alias lookup for import preview. Takes an array of chemical names and returns
-- exact case-insensitive matches. Using RPC avoids URL-encoding issues with long chemical
-- names that contain commas (common in IUPAC nomenclature).
create or replace function public.match_chemicals_by_names(names text[])
returns table (input_name text, chemical_id uuid, common_name text, cas_number text)
language sql
stable
security definer
set search_path = regulatory, public
as $$
  select ca.alias   as input_name,
         c.id       as chemical_id,
         c.common_name,
         c.cas_number
  from   regulatory.chemical_aliases ca
  join   regulatory.chemicals        c on c.id = ca.chemical_id
  where  lower(ca.alias) = any(select lower(n) from unnest(names) as t(n))
$$;
