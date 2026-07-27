-- ─────────────────────────────────────────────────────────────────────────────
-- Supabase advisor: unindexed_foreign_keys. Postgres never auto-indexes FK
-- columns (unlike the primary key they point to), so joins/filters on these
-- columns do a sequential scan and deletes on the parent row scan the whole
-- child table to check for references. Indexing the FK columns that back
-- real "show me everything for this X" query patterns; deliberately NOT
-- indexing audit-trail columns (created_by, updated_by, assigned_by,
-- performed_by, confirmed_by, etc.) since those are typically only
-- displayed, not filtered/joined on, and the extra index would just add
-- write overhead with no query benefit.
-- Migration: 20260723000016_index_hot_foreign_keys.sql
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_jobs_company_id ON recruitment.jobs (company_id);
CREATE INDEX IF NOT EXISTS idx_placements_candidate_id ON recruitment.placements (candidate_id);
CREATE INDEX IF NOT EXISTS idx_placements_job_id ON recruitment.placements (job_id);
CREATE INDEX IF NOT EXISTS idx_consultation_chemicals_chemical_id ON regulatory.consultation_chemicals (chemical_id);
CREATE INDEX IF NOT EXISTS idx_tasks_candidate_id ON recruitment.tasks (candidate_id);
CREATE INDEX IF NOT EXISTS idx_tasks_job_id ON recruitment.tasks (job_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_contact_id ON crm.opportunities (contact_id);
