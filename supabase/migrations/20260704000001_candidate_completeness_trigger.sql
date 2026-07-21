-- ─────────────────────────────────────────────────────────────────────────────
-- Auto-recompute profile_completeness_pct on every candidate write
-- Migration: 20260704000001_candidate_completeness_trigger.sql
--
-- Previously, profile_completeness_pct was only calculated inside the
-- upsert_candidate() RPC (used on creation/dedup-merge). Editing a candidate
-- afterward via PATCH /api/recruitment/candidates/[id] never recalculated it,
-- so the percentage went stale as soon as someone filled in missing fields
-- through the UI. A BEFORE INSERT OR UPDATE trigger keeps it correct for any
-- write path (API PATCH, upsert_candidate, future imports) without needing
-- every caller to remember to recompute it.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION recruitment.compute_candidate_completeness()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.profile_completeness_pct := (
    (CASE WHEN NEW.phone IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN NEW.current_title IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN NEW.current_employer IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN NEW.location_city IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN NEW.raw_resume_text IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN NEW.parsed_metadata IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN array_length(NEW.skills_tags, 1) IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN NEW.security_clearance_level IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN NEW.field_of_study IS NOT NULL THEN 1 ELSE 0 END)
  )::numeric * 100 / 9;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_compute_candidate_completeness ON recruitment.candidates;
CREATE TRIGGER trg_compute_candidate_completeness
  BEFORE INSERT OR UPDATE ON recruitment.candidates
  FOR EACH ROW
  EXECUTE FUNCTION recruitment.compute_candidate_completeness();
