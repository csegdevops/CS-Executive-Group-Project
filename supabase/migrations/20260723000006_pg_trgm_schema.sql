-- ─────────────────────────────────────────────────────────────────────────────
-- Supabase advisor: pg_trgm is installed in public — move it to a dedicated
-- schema, the standard Supabase pattern (keeps public free of extension
-- objects/functions). Uses ALTER EXTENSION ... SET SCHEMA (not drop+recreate),
-- so the existing GIN trigram indexes (idx_chemicals_*_trgm,
-- idx_chemical_aliases_alias_trgm — 20260623000001_search_indexes.sql) keep
-- working unchanged: their operator-class binding is resolved by catalog OID
-- at index-creation time, not by search_path at query time. No application
-- code calls pg_trgm functions (similarity(), %, word_similarity()) directly —
-- it's only ever used via the GIN indexes to speed up ILIKE — so nothing else
-- needs to change.
-- Migration: 20260723000006_pg_trgm_schema.sql
-- ─────────────────────────────────────────────────────────────────────────────

CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

ALTER EXTENSION pg_trgm SET SCHEMA extensions;
