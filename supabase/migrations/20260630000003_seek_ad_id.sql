-- Add seek_ad_id to recruitment.jobs
-- Stores Seek's advertisementId after a job is posted via the Employer API.
-- Required for: ad withdrawal, webhook job matching, deduplication.

ALTER TABLE recruitment.jobs
  ADD COLUMN IF NOT EXISTS seek_ad_id text UNIQUE;

CREATE INDEX IF NOT EXISTS idx_jobs_seek_ad_id ON recruitment.jobs (seek_ad_id)
  WHERE seek_ad_id IS NOT NULL;
