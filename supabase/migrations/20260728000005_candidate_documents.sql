-- ─────────────────────────────────────────────────────────────────────────────
-- candidate_documents: rolling history of a candidate's CVs/cover letters.
-- Replaces the single-slot candidates.cv_storage_key/cl_storage_key columns
-- (which get dropped below) with a proper history table — application code
-- prunes each candidate+doc_type down to the 3 most recent rows on every
-- ingest. "Current" is simply the newest row per doc_type; there is no
-- separate pointer column to keep in sync.
-- Migration: 20260728000005_candidate_documents.sql
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE recruitment.candidate_documents (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id   uuid        NOT NULL REFERENCES recruitment.candidates(id) ON DELETE CASCADE,
  application_id uuid        REFERENCES recruitment.applications(id) ON DELETE SET NULL,
  doc_type       text        NOT NULL CHECK (doc_type IN ('cv', 'cl')),
  storage_key    text        NOT NULL,
  original_name  text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON recruitment.candidate_documents(candidate_id, doc_type, created_at DESC);
CREATE INDEX ON recruitment.candidate_documents(application_id) WHERE application_id IS NOT NULL;

ALTER TABLE recruitment.candidate_documents ENABLE ROW LEVEL SECURITY;
GRANT ALL ON recruitment.candidate_documents TO service_role;

-- Backfill: each existing candidate's single current CV/CL becomes their
-- first history row, before the source columns are dropped below.
INSERT INTO recruitment.candidate_documents (candidate_id, doc_type, storage_key, original_name, created_at)
SELECT id, 'cv', cv_storage_key, cv_original_name, updated_at
FROM recruitment.candidates
WHERE cv_storage_key IS NOT NULL;

INSERT INTO recruitment.candidate_documents (candidate_id, doc_type, storage_key, original_name, created_at)
SELECT id, 'cl', cl_storage_key, cl_original_name, updated_at
FROM recruitment.candidates
WHERE cl_storage_key IS NOT NULL;

ALTER TABLE recruitment.candidates
  DROP COLUMN cv_storage_key,
  DROP COLUMN cv_original_name,
  DROP COLUMN cl_storage_key,
  DROP COLUMN cl_original_name;
