-- ─────────────────────────────────────────────────────────────────────────────
-- Candidate profile: postcode, employment status, citizenship/work rights,
-- secondary email
-- Migration: 20260704000002_candidate_profile_fields.sql
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE recruitment.candidates
  ADD COLUMN IF NOT EXISTS location_postcode text,
  ADD COLUMN IF NOT EXISTS secondary_email   text,
  ADD COLUMN IF NOT EXISTS citizenship_status text,
  ADD COLUMN IF NOT EXISTS employment_status text NOT NULL DEFAULT 'employed'
    CHECK (employment_status IN ('employed', 'not_working'));

-- "None" option for security clearance — an explicit, deliberate answer
-- (distinct from NULL/unknown), so it still counts toward profile
-- completeness via the existing NOT NULL check in the completeness trigger.
INSERT INTO public.lookup_values (scope, category, value, label, sort_order) VALUES
  ('global', 'security_clearance_level', 'none', 'None', 0)
ON CONFLICT (scope, category, value) DO NOTHING;

-- Citizenship / work rights reference data — editable later via the
-- lookup-values admin UI if the exact set needs adjusting.
INSERT INTO public.lookup_values (scope, category, value, label, sort_order) VALUES
  ('recruitment', 'citizenship_status', 'australian_citizen', 'Australian Citizen',            10),
  ('recruitment', 'citizenship_status', 'nz_citizen',          'New Zealand Citizen',           20),
  ('recruitment', 'citizenship_status', 'permanent_resident',  'Permanent Resident',             30),
  ('recruitment', 'citizenship_status', 'work_visa',           'Work Visa (e.g. subclass 482/186)', 40),
  ('recruitment', 'citizenship_status', 'student_visa',        'Student Visa (with work rights)', 50),
  ('recruitment', 'citizenship_status', 'working_holiday',     'Working Holiday Visa',           60),
  ('recruitment', 'citizenship_status', 'no_work_rights',      'No Work Rights',                 70),
  ('recruitment', 'citizenship_status', 'other',               'Other',                          80)
ON CONFLICT (scope, category, value) DO NOTHING;
