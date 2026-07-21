-- ─────────────────────────────────────────────────────────────────────────────
-- Candidate "latest" CV/cover-letter pointers + private Storage bucket
-- Migration: 20260704000003_candidate_cv_storage.sql
--
-- Mirrors the existing cv_storage_key/cl_storage_key columns on
-- recruitment.applications (per-application snapshot) with a "latest" copy
-- on the candidate profile, so recruiters can reference the most recent
-- resume/cover letter regardless of which application it came from. Any
-- inbound application (any source_channel) overwrites this pointer; manually
-- assigning an existing candidate to a job reads from it instead of
-- prompting for a new upload.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE recruitment.candidates
  ADD COLUMN IF NOT EXISTS cv_storage_key   text,
  ADD COLUMN IF NOT EXISTS cv_original_name text,
  ADD COLUMN IF NOT EXISTS cl_storage_key   text,
  ADD COLUMN IF NOT EXISTS cl_original_name text;

-- Private bucket — all access goes through the service-role client in API
-- routes (matching consultation_notes' "service role only" pattern), with
-- signed URLs generated on demand for viewing/downloading.
INSERT INTO storage.buckets (id, name, public)
VALUES ('candidate-documents', 'candidate-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "candidate_documents_service_role_only"
  ON storage.objects FOR ALL
  USING (bucket_id = 'candidate-documents' AND auth.role() = 'service_role')
  WITH CHECK (bucket_id = 'candidate-documents' AND auth.role() = 'service_role');
