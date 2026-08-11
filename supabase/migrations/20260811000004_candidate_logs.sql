-- ─────────────────────────────────────────────────────────────────────────────
-- candidate_logs: audit trail of candidate registration + profile changes,
-- surfaced on a super-admin-only "Logs" tab on the candidate detail page.
-- Same access pattern as candidate_documents/candidate_notes: RLS enabled,
-- no policy — all access goes through the admin (service_role) client, with
-- the API route restricting reads to super_admin.
--
-- Populated by a trigger rather than app-level logging calls, because
-- candidates rows are written from many places: the manual "Add Candidate"
-- API route, upsert_candidate (called from the Seek webhook,
-- /api/public/apply, and /api/applications' 3 WordPress form handlers),
-- merge_candidates, the CV parser (parseCandidateCv), the skills/education
-- tag editors, and trg_update_candidate_on_placement. A trigger is the only
-- way to guarantee every one of those is captured without relying on each
-- call site remembering to log — the same reasoning that already led to
-- trg_log_application_stage_change for applications.
--
-- UPDATE rows can't attribute a specific admin (same limitation already
-- accepted for trg_log_application_stage_change's changed_by = NULL) — a
-- row-level trigger has no visibility into which authenticated user issued
-- the statement, only the data change itself. INSERT rows do get
-- performed_by, since candidates.added_by is already a normal column
-- available on NEW (set by the manual add route, NULL for webhook-created
-- candidates).
-- Migration: 20260811000004_candidate_logs.sql
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE recruitment.candidate_logs (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id  uuid        NOT NULL REFERENCES recruitment.candidates(id) ON DELETE CASCADE,
  action        text        NOT NULL,
  details       jsonb,
  performed_by  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON recruitment.candidate_logs(candidate_id, created_at DESC);

ALTER TABLE recruitment.candidate_logs ENABLE ROW LEVEL SECURITY;
GRANT ALL ON recruitment.candidate_logs TO service_role;

CREATE OR REPLACE FUNCTION recruitment.log_candidate_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = recruitment, public
AS $$
DECLARE
  v_old      jsonb;
  v_new      jsonb;
  v_diff     jsonb := '[]'::jsonb;
  v_key      text;
  -- Excluded from diffing: derived/bookkeeping columns that change on every
  -- save regardless of what actually changed (updated_at,
  -- profile_completeness_pct, the generated fts_vector), plus large
  -- free-text blobs that would make the log unreadable and bloat storage on
  -- every CV parse (raw_resume_text, parsed_metadata, cv_parsed_at).
  v_excluded text[] := ARRAY[
    'updated_at', 'profile_completeness_pct', 'fts_vector',
    'raw_resume_text', 'parsed_metadata', 'cv_parsed_at'
  ];
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO recruitment.candidate_logs (candidate_id, action, details, performed_by)
    VALUES (
      NEW.id, 'registered',
      jsonb_build_object('email', NEW.email, 'source_channel', NEW.source_channel),
      NEW.added_by
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    FOR v_key IN SELECT jsonb_object_keys(v_new) LOOP
      IF v_key = ANY(v_excluded) THEN CONTINUE; END IF;
      IF v_old -> v_key IS DISTINCT FROM v_new -> v_key THEN
        v_diff := v_diff || jsonb_build_object('field', v_key, 'old', v_old -> v_key, 'new', v_new -> v_key);
      END IF;
    END LOOP;

    IF jsonb_array_length(v_diff) > 0 THEN
      INSERT INTO recruitment.candidate_logs (candidate_id, action, details, performed_by)
      VALUES (NEW.id, 'updated', jsonb_build_object('changes', v_diff), NULL);
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_candidate_change
AFTER INSERT OR UPDATE ON recruitment.candidates
FOR EACH ROW EXECUTE FUNCTION recruitment.log_candidate_change();
