-- Job compliance requirements (Australian standards):
--   - security_clearance_level_required: which AGSVA level, reusing the same
--     'security_clearance_level' lookup category candidates already use
--     (none/baseline/nv1/nv2/pv/tsc) so a job's requirement and a
--     candidate's held clearance are directly comparable.
--   - right_to_work_check_required + notes: visa/work-rights verification
--     needed before placement.
-- security_clearance_required (existing boolean, read by downstream
-- matching/task logic) stays as-is — the UI now derives it from whichever
-- level is selected rather than a separate checkbox.
-- Migration: 20260810000007_job_compliance_requirements.sql

ALTER TABLE recruitment.jobs
  ADD COLUMN security_clearance_level_required text,
  ADD COLUMN right_to_work_check_required       boolean NOT NULL DEFAULT false,
  ADD COLUMN right_to_work_notes                text;

-- Backfill: existing jobs flagged security_clearance_required with no level
-- on record default to 'baseline' so the two fields don't disagree.
UPDATE recruitment.jobs
SET security_clearance_level_required = 'baseline'
WHERE security_clearance_required = true AND security_clearance_level_required IS NULL;
