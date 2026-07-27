-- ─────────────────────────────────────────────────────────────────────────────
-- Discovered live drift (not introduced by this session): the migration that
-- added p_field_of_study to recruitment.upsert_candidate
-- (20260701000003_candidate_field_of_study.sql) inserted the new parameter
-- before the trailing p_source_channel/p_added_by args instead of appending
-- it at the end. Postgres matches CREATE OR REPLACE by full type signature,
-- so that shifted every subsequent parameter's position and registered a
-- second, distinct overload instead of replacing the original — both the
-- 14-param (no field_of_study) and 15-param versions have coexisted in the
-- live database ever since.
--
-- This is a live bug: recruitment/applications/route.ts calls upsert_candidate
-- with only 6 named args (p_email, p_phone, p_first_name, p_last_name,
-- p_source_channel, p_added_by) — every other parameter is optional with a
-- default in *both* overloads, so that call is genuinely ambiguous and errors
-- with "function ... is not unique". Dropping the old 14-param signature
-- resolves the ambiguity; all 3 call sites in src/ are compatible with the
-- remaining 15-param version.
-- Migration: 20260723000010_drop_duplicate_upsert_candidate_overload.sql
-- ─────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS recruitment.upsert_candidate(
  text, text, text, text, text, text, text, text, text, text, jsonb, text[], text, uuid
);
