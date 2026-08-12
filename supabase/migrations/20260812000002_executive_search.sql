-- ─────────────────────────────────────────────────────────────────────────────
-- Executive-search microsite support: flag + content fields on jobs, plus a
-- job_documents table for candidate information packs (mirrors
-- recruitment.candidate_documents, 20260728000005). The WordPress-side
-- custom post type/template is built separately — this only tracks the
-- content in the portal and feeds it to the wordpress-post push route.
-- Migration: 20260812000002_executive_search.sql
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE recruitment.jobs
  ADD COLUMN IF NOT EXISTS is_executive_search    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS confidential_mode      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS narrative_copy         text,
  ADD COLUMN IF NOT EXISTS hero_image_storage_key text;

CREATE TABLE recruitment.job_documents (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id        uuid        NOT NULL REFERENCES recruitment.jobs(id) ON DELETE CASCADE,
  storage_key   text        NOT NULL,
  original_name text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON recruitment.job_documents(job_id, created_at DESC);

ALTER TABLE recruitment.job_documents ENABLE ROW LEVEL SECURITY;
GRANT ALL ON recruitment.job_documents TO service_role;

-- Private bucket — same "service role only" pattern as candidate-documents
-- (20260704000003). Holds both the hero image and info-pack files; the
-- WordPress push route uploads the hero image into WP's own media library
-- on post rather than exposing a public URL out of this private bucket.
INSERT INTO storage.buckets (id, name, public)
VALUES ('job-documents', 'job-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "job_documents_service_role_only"
  ON storage.objects FOR ALL
  USING (bucket_id = 'job-documents' AND auth.role() = 'service_role')
  WITH CHECK (bucket_id = 'job-documents' AND auth.role() = 'service_role');
