-- ─────────────────────────────────────────────────────────────────────────────
-- Candidate profile: LinkedIn, Seek Talent profile, preferred work types,
-- current salary, expected salary band (reference data) + candidate notes
-- Migration: 20260728000001_candidate_profile_and_notes.sql
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE recruitment.candidates
  ADD COLUMN IF NOT EXISTS linkedin_url            text,
  ADD COLUMN IF NOT EXISTS seek_talent_profile_url  text,
  ADD COLUMN IF NOT EXISTS preferred_work_types     text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS current_salary           numeric(12,2),
  ADD COLUMN IF NOT EXISTS base_salary_expected     text;

-- Expected salary band — reference data, editable later via the
-- lookup-values admin UI. preferred_work_types reuses the existing
-- recruitment/employment_type category (same options jobs already use).
INSERT INTO public.lookup_values (scope, category, value, label, sort_order) VALUES
  ('recruitment', 'salary_band', 'under_100k', 'Under $100k',   10),
  ('recruitment', 'salary_band', '100k_150k',  '$100k – $150k', 20),
  ('recruitment', 'salary_band', '150k_200k',  '$150k – $200k', 30),
  ('recruitment', 'salary_band', '200k_250k',  '$200k – $250k', 40),
  ('recruitment', 'salary_band', '250k_300k',  '$250k – $300k', 50),
  ('recruitment', 'salary_band', '300k_plus',  '$300k+',        60)
ON CONFLICT (scope, category, value) DO NOTHING;

-- ─── Candidate Notes ─────────────────────────────────────────────────────────
-- Recruiter comments on a candidate profile — same pattern as
-- regulatory.consultation_notes: service-role-only access via the admin
-- client (API enforces auth + author-scoped delete), no authenticated-key
-- RLS policy needed.

CREATE TABLE recruitment.candidate_notes (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id  uuid        NOT NULL REFERENCES recruitment.candidates(id) ON DELETE CASCADE,
  author_id     uuid        NOT NULL,
  content       text        NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON recruitment.candidate_notes(candidate_id);

ALTER TABLE recruitment.candidate_notes ENABLE ROW LEVEL SECURITY;
GRANT ALL ON recruitment.candidate_notes TO service_role;
