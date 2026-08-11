-- ─────────────────────────────────────────────────────────────────────────────
-- candidate_logs: surface which submission triggered a change ("via").
--
-- The 3 WordPress form handlers in /api/applications already stamp
-- self_reported_metadata.updated_via with 'job_application' /
-- 'talent_pool_registration' / 'application_detail_update' (see
-- buildSelfReportedMetadata in route.ts). Previously the trigger diffed
-- self_reported_metadata like any other column, which just dumped the whole
-- JSON blob as an unreadable old-JSON -> new-JSON line. This replaces that
-- with a dedicated `via` key on both 'registered' and 'updated' log rows —
-- self_reported_metadata itself moves to the excluded-columns list so it no
-- longer appears as a raw diff entry.
--
-- Same signature as the existing log_candidate_change() — CREATE OR REPLACE
-- genuinely replaces it in place here (no new overload), since only the body
-- changes, not the parameter list. (Changing the parameter list is what
-- created the recruitment.upsert_candidate duplicate-overload mess earlier
-- this session — not a risk here.)
-- Migration: 20260811000005_candidate_logs_via.sql
-- ─────────────────────────────────────────────────────────────────────────────

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
  v_via      text;
  v_excluded text[] := ARRAY[
    'updated_at', 'profile_completeness_pct', 'fts_vector',
    'raw_resume_text', 'parsed_metadata', 'cv_parsed_at',
    'self_reported_metadata'
  ];
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO recruitment.candidate_logs (candidate_id, action, details, performed_by)
    VALUES (
      NEW.id, 'registered',
      jsonb_build_object(
        'email', NEW.email,
        'source_channel', NEW.source_channel,
        'via', NEW.self_reported_metadata ->> 'updated_via'
      ),
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

    IF OLD.self_reported_metadata IS DISTINCT FROM NEW.self_reported_metadata THEN
      v_via := NEW.self_reported_metadata ->> 'updated_via';
    END IF;

    IF jsonb_array_length(v_diff) > 0 OR v_via IS NOT NULL THEN
      INSERT INTO recruitment.candidate_logs (candidate_id, action, details, performed_by)
      VALUES (NEW.id, 'updated', jsonb_build_object('changes', v_diff, 'via', v_via), NULL);
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;
