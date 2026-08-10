-- ─────────────────────────────────────────────────────────────────────────────
-- Contract leave periods + structured update notes.
--
-- Replaces the old "one giant chronological comment blob" pattern with:
--   - contract_leave_periods: structured leave records, rendered as a
--     distinct-colored timeline entry and an "on leave" badge while
--     start_date <= today <= (end_date ?? infinity).
--   - contract_notes: a lightweight categorized note log (compliance,
--     client instruction, schedule, rate note, other) — merged into the
--     same on-page timeline as extensions/renewals/leave, mirroring the
--     job_events pattern (recruitment.job_events) already used for Jobs.
-- Migration: 20260810000003_contract_leave_and_notes.sql
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE recruitment.contract_leave_periods (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid        NOT NULL REFERENCES recruitment.contracts(id) ON DELETE CASCADE,
  start_date  date        NOT NULL,
  end_date    date,
  reason      text,
  notes       text,
  created_by  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_contract_leave_periods_contract ON recruitment.contract_leave_periods (contract_id, start_date);

CREATE TABLE recruitment.contract_notes (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id  uuid        NOT NULL REFERENCES recruitment.contracts(id) ON DELETE CASCADE,
  category     text        NOT NULL
                 CHECK (category IN ('compliance', 'client_instruction', 'schedule', 'rate_note', 'other')),
  note         text        NOT NULL,
  performed_by uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_contract_notes_contract ON recruitment.contract_notes (contract_id, created_at DESC);

ALTER TABLE recruitment.contract_leave_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruitment.contract_notes         ENABLE ROW LEVEL SECURITY;

CREATE POLICY recruitment_module_access ON recruitment.contract_leave_periods
  FOR ALL TO authenticated USING (has_module_access('recruitment'));
CREATE POLICY recruitment_module_access ON recruitment.contract_notes
  FOR ALL TO authenticated USING (has_module_access('recruitment'));

GRANT SELECT, INSERT, UPDATE, DELETE ON recruitment.contract_leave_periods, recruitment.contract_notes TO authenticated, service_role;
