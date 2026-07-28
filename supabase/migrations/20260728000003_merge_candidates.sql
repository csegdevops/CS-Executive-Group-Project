-- ─────────────────────────────────────────────────────────────────────────────
-- merge_candidates: consolidate a duplicate candidate profile into a primary
-- one, reassigning applications/placements/tasks/notes, COALESCE-merging
-- profile fields (never overwriting a non-null value on primary), then
-- deleting the duplicate row. The duplicate is hard-deleted rather than
-- soft-deactivated: upsert_candidate does not filter by is_active, so a
-- surviving deactivated row with its original email intact would still
-- match future submissions from that email, silently undoing the merge.
-- Migration: 20260728000003_merge_candidates.sql
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION recruitment.merge_candidates(
  p_primary_id    uuid,
  p_duplicate_id  uuid,
  p_merged_by     uuid
)
RETURNS TABLE (
  primary_id            uuid,
  duplicate_id          uuid,
  applications_moved    integer,
  applications_dropped  integer,
  placements_moved      integer,
  tasks_moved           integer,
  notes_moved           integer,
  secondary_email_set   boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = recruitment, public
AS $$
DECLARE
  v_primary   recruitment.candidates%ROWTYPE;
  v_dup       recruitment.candidates%ROWTYPE;
  v_lock_lo   uuid;
  v_lock_hi   uuid;
  v_apps_moved       integer := 0;
  v_apps_dropped     integer := 0;
  v_placements_moved integer := 0;
  v_tasks_moved      integer := 0;
  v_notes_moved      integer := 0;
  v_dup_app          RECORD;
  v_primary_app      RECORD;
  v_dup_has_placement     boolean;
  v_primary_has_placement boolean;
  v_new_secondary_email text;
  v_secondary_email_set boolean := false;
BEGIN
  IF p_primary_id = p_duplicate_id THEN
    RAISE EXCEPTION 'Cannot merge a candidate into itself';
  END IF;

  -- Lock both rows in a consistent order (ascending id, not by role) so two
  -- concurrent merges can never deadlock against each other.
  IF p_primary_id < p_duplicate_id THEN
    v_lock_lo := p_primary_id; v_lock_hi := p_duplicate_id;
  ELSE
    v_lock_lo := p_duplicate_id; v_lock_hi := p_primary_id;
  END IF;

  PERFORM 1 FROM recruitment.candidates WHERE id = v_lock_lo FOR UPDATE;
  PERFORM 1 FROM recruitment.candidates WHERE id = v_lock_hi FOR UPDATE;

  SELECT * INTO v_primary FROM recruitment.candidates WHERE id = p_primary_id;
  SELECT * INTO v_dup     FROM recruitment.candidates WHERE id = p_duplicate_id;

  IF v_primary.id IS NULL THEN
    RAISE EXCEPTION 'Primary candidate not found';
  END IF;
  IF v_dup.id IS NULL THEN
    RAISE EXCEPTION 'Duplicate candidate not found';
  END IF;

  -- ─── Applications ──────────────────────────────────────────────────────────
  -- Bulk-repoint every duplicate application to a job the primary hasn't
  -- applied to (no UNIQUE(job_id, candidate_id) collision possible there).
  UPDATE recruitment.applications a
  SET candidate_id = p_primary_id
  WHERE a.candidate_id = p_duplicate_id
    AND NOT EXISTS (
      SELECT 1 FROM recruitment.applications p
      WHERE p.candidate_id = p_primary_id AND p.job_id = a.job_id
    );
  GET DIAGNOSTICS v_apps_moved = ROW_COUNT;

  -- Whatever's left is exactly the job-collision cases — resolve each one.
  FOR v_dup_app IN
    SELECT * FROM recruitment.applications WHERE candidate_id = p_duplicate_id
  LOOP
    SELECT * INTO v_primary_app
    FROM recruitment.applications
    WHERE candidate_id = p_primary_id AND job_id = v_dup_app.job_id;

    v_dup_has_placement := EXISTS (
      SELECT 1 FROM recruitment.placements WHERE application_id = v_dup_app.id
    );
    v_primary_has_placement := EXISTS (
      SELECT 1 FROM recruitment.placements WHERE application_id = v_primary_app.id
    );

    IF v_dup_has_placement AND v_primary_has_placement THEN
      -- Both sides were independently placed into the same job — a genuine
      -- data conflict. Abort the whole merge rather than silently pick one.
      RAISE EXCEPTION
        'Both candidates have an active placement for job %; resolve manually before merging',
        v_dup_app.job_id;
    ELSIF v_dup_has_placement THEN
      -- Duplicate's application carries real placement history — keep it,
      -- drop primary's colliding (unplaced) application instead.
      DELETE FROM recruitment.applications WHERE id = v_primary_app.id;
      UPDATE recruitment.applications SET candidate_id = p_primary_id WHERE id = v_dup_app.id;
      v_apps_moved   := v_apps_moved + 1;
      v_apps_dropped := v_apps_dropped + 1;
    ELSE
      -- Default: keep primary's existing application, discard duplicate's.
      DELETE FROM recruitment.applications WHERE id = v_dup_app.id;
      v_apps_dropped := v_apps_dropped + 1;
    END IF;
  END LOOP;

  -- ─── Placements ────────────────────────────────────────────────────────────
  UPDATE recruitment.placements SET candidate_id = p_primary_id WHERE candidate_id = p_duplicate_id;
  GET DIAGNOSTICS v_placements_moved = ROW_COUNT;

  -- ─── Tasks ─────────────────────────────────────────────────────────────────
  UPDATE recruitment.tasks SET candidate_id = p_primary_id WHERE candidate_id = p_duplicate_id;
  GET DIAGNOSTICS v_tasks_moved = ROW_COUNT;

  -- ─── Candidate notes ───────────────────────────────────────────────────────
  UPDATE recruitment.candidate_notes SET candidate_id = p_primary_id WHERE candidate_id = p_duplicate_id;
  GET DIAGNOSTICS v_notes_moved = ROW_COUNT;

  -- ─── Secondary email preservation ──────────────────────────────────────────
  -- If primary's secondary_email slot is free, adopt the duplicate's email
  -- (or its own secondary_email) so future submissions from that address
  -- resolve to the merged primary going forward.
  v_new_secondary_email := CASE
    WHEN v_primary.secondary_email IS NOT NULL THEN NULL
    WHEN lower(v_dup.email) <> lower(v_primary.email) THEN v_dup.email
    WHEN v_dup.secondary_email IS NOT NULL AND lower(v_dup.secondary_email) <> lower(v_primary.email)
      THEN v_dup.secondary_email
    ELSE NULL
  END;
  v_secondary_email_set := v_new_secondary_email IS NOT NULL;

  -- ─── Scalar + array field merge onto primary ──────────────────────────────
  -- COALESCE philosophy: never overwrite a non-null value already on primary.
  UPDATE recruitment.candidates
  SET
    secondary_email             = COALESCE(secondary_email, v_new_secondary_email),
    phone                       = COALESCE(phone, v_dup.phone),
    current_title               = COALESCE(current_title, v_dup.current_title),
    current_employer            = COALESCE(current_employer, v_dup.current_employer),
    location_city                = COALESCE(location_city, v_dup.location_city),
    location_state                = COALESCE(location_state, v_dup.location_state),
    location_postcode             = COALESCE(location_postcode, v_dup.location_postcode),
    citizenship_status             = COALESCE(citizenship_status, v_dup.citizenship_status),
    raw_resume_text                 = COALESCE(raw_resume_text, v_dup.raw_resume_text),
    parsed_metadata                  = COALESCE(parsed_metadata, v_dup.parsed_metadata),
    field_of_study                    = COALESCE(field_of_study, v_dup.field_of_study),
    security_clearance_level           = COALESCE(security_clearance_level, v_dup.security_clearance_level),
    security_clearance_verified         = security_clearance_verified OR v_dup.security_clearance_verified,
    security_clearance_expiry            = COALESCE(security_clearance_expiry, v_dup.security_clearance_expiry),
    source_channel                        = COALESCE(source_channel, v_dup.source_channel),
    cv_parse_status  = CASE WHEN cv_storage_key IS NULL THEN v_dup.cv_parse_status ELSE cv_parse_status END,
    cv_parsed_by     = CASE WHEN cv_storage_key IS NULL THEN v_dup.cv_parsed_by    ELSE cv_parsed_by    END,
    cv_parsed_at     = CASE WHEN cv_storage_key IS NULL THEN v_dup.cv_parsed_at    ELSE cv_parsed_at    END,
    cv_storage_key   = COALESCE(cv_storage_key, v_dup.cv_storage_key),
    cv_original_name = COALESCE(cv_original_name, v_dup.cv_original_name),
    cl_storage_key   = COALESCE(cl_storage_key, v_dup.cl_storage_key),
    cl_original_name = COALESCE(cl_original_name, v_dup.cl_original_name),
    linkedin_url               = COALESCE(linkedin_url, v_dup.linkedin_url),
    seek_talent_profile_url     = COALESCE(seek_talent_profile_url, v_dup.seek_talent_profile_url),
    current_salary                = COALESCE(current_salary, v_dup.current_salary),
    base_salary_expected           = COALESCE(base_salary_expected, v_dup.base_salary_expected),
    skills_tags            = ARRAY(SELECT DISTINCT x FROM unnest(COALESCE(skills_tags, '{}') || COALESCE(v_dup.skills_tags, '{}')) AS t(x)),
    education_tags           = ARRAY(SELECT DISTINCT x FROM unnest(COALESCE(education_tags, '{}') || COALESCE(v_dup.education_tags, '{}')) AS t(x)),
    preferred_work_types        = ARRAY(SELECT DISTINCT x FROM unnest(COALESCE(preferred_work_types, '{}') || COALESCE(v_dup.preferred_work_types, '{}')) AS t(x))
  WHERE id = p_primary_id;

  -- ─── Audit note on primary ─────────────────────────────────────────────────
  INSERT INTO recruitment.candidate_notes (candidate_id, author_id, content)
  VALUES (
    p_primary_id,
    p_merged_by,
    format(
      'Merged duplicate profile "%s %s" (%s) into this record. %s application(s) moved, %s discarded as duplicates; %s placement(s) moved; %s task(s) moved; %s note(s) moved.',
      v_dup.first_name, v_dup.last_name, v_dup.email,
      v_apps_moved, v_apps_dropped, v_placements_moved, v_tasks_moved, v_notes_moved
    )
  );

  -- ─── Delete the duplicate ──────────────────────────────────────────────────
  -- Safe: every child row was repointed above, nothing references it anymore.
  DELETE FROM recruitment.candidates WHERE id = p_duplicate_id;

  RETURN QUERY SELECT
    p_primary_id,
    p_duplicate_id,
    v_apps_moved,
    v_apps_dropped,
    v_placements_moved,
    v_tasks_moved,
    v_notes_moved,
    v_secondary_email_set;
END;
$$;

REVOKE ALL ON FUNCTION recruitment.merge_candidates(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION recruitment.merge_candidates(uuid, uuid, uuid) TO service_role;
