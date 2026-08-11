-- ─────────────────────────────────────────────────────────────────────────────
-- Drop stale upsert_candidate overloads.
--
-- CREATE OR REPLACE FUNCTION does NOT replace a function in place when new
-- trailing parameters are added — Postgres treats a different parameter list
-- as a distinct overload and creates it alongside the old one. This exact
-- mistake was made (and fixed) once before in
-- 20260723000010_drop_duplicate_upsert_candidate_overload.sql, and the
-- previous migration (20260810000001_upsert_candidate_linkedin_salary.sql,
-- followed by this session's 20260811000001) repeated it silently — by the
-- time this migration runs there are 3 live overloads (15, 18, and 20
-- params), all differing only in trailing DEFAULT-valued params.
--
-- This is not just a cleanliness issue: any RPC call over PostgREST that
-- only supplies the common leading named params (e.g. the Seek webhook and
-- /api/public/apply, which only pass ~6-9 of them) is ambiguous across all
-- 3 overloads and Postgres will reject it as "function is not unique".
--
-- Fix: drop the two superseded overloads, keeping only the current
-- (20-param, self_reported_metadata + p_overwrite) version. Every existing
-- caller already sends a subset of that version's named params, so behavior
-- for them is unchanged.
-- Migration: 20260811000002_drop_duplicate_upsert_candidate_overloads.sql
-- ─────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS recruitment.upsert_candidate(
  p_email                text,
  p_phone                text,
  p_first_name           text,
  p_last_name            text,
  p_current_title        text,
  p_current_employer     text,
  p_location_city        text,
  p_location_state       text,
  p_location_country     text,
  p_raw_resume_text      text,
  p_parsed_metadata      jsonb,
  p_skills_tags          text[],
  p_field_of_study       text,
  p_source_channel       text,
  p_added_by             uuid
);

DROP FUNCTION IF EXISTS recruitment.upsert_candidate(
  p_email                text,
  p_phone                text,
  p_first_name           text,
  p_last_name            text,
  p_current_title        text,
  p_current_employer     text,
  p_location_city        text,
  p_location_state       text,
  p_location_country     text,
  p_raw_resume_text      text,
  p_parsed_metadata      jsonb,
  p_skills_tags          text[],
  p_field_of_study       text,
  p_source_channel       text,
  p_added_by             uuid,
  p_linkedin_url         text,
  p_current_salary       numeric,
  p_base_salary_expected text
);
