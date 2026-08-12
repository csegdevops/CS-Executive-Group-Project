-- Add WordPress push-posting tracking to recruitment.jobs
-- Mirrors the seek_ad_id precedent (20260630000003_seek_ad_id.sql) for the
-- new "Post to WordPress" button — wp_post_id is the WP post ID returned by
-- the WP REST API on create, wp_permalink is its public URL for linking
-- back from the portal.

ALTER TABLE recruitment.jobs
  ADD COLUMN IF NOT EXISTS wp_post_id text,
  ADD COLUMN IF NOT EXISTS wp_permalink text;

CREATE INDEX IF NOT EXISTS idx_jobs_wp_post_id ON recruitment.jobs (wp_post_id)
  WHERE wp_post_id IS NOT NULL;
