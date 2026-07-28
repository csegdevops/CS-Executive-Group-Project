-- ─────────────────────────────────────────────────────────────────────────────
-- current_title/current_employer should only ever auto-update when a
-- candidate is actually placed — not from CV parsing or self-reported web
-- application data, both of which are unverified. On placement, these
-- become the job's title and the client company's name (the placement IS
-- the verified source of truth). Manual edits via the recruiter-facing Add/
-- Edit candidate dialogs are untouched — those are deliberate human actions,
-- not "automatic" in the sense being scoped out here.
-- Migration: 20260728000008_placement_updates_candidate_title.sql
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION recruitment.update_candidate_on_placement()
RETURNS trigger AS $$
DECLARE
  v_job_title    text;
  v_company_name text;
BEGIN
  SELECT j.title, c.name
  INTO v_job_title, v_company_name
  FROM recruitment.jobs j
  JOIN public.companies c ON c.id = j.company_id
  WHERE j.id = NEW.job_id;

  UPDATE recruitment.candidates
  SET
    current_title    = COALESCE(v_job_title, current_title),
    current_employer = COALESCE(v_company_name, current_employer)
  WHERE id = NEW.candidate_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_candidate_on_placement
  AFTER INSERT ON recruitment.placements
  FOR EACH ROW EXECUTE FUNCTION recruitment.update_candidate_on_placement();
