-- ─────────────────────────────────────────────────────────────────────────────
-- upsert_candidate: accept linkedin_url / current_salary / base_salary_expected
-- so website (Gravity Forms) submissions can populate them. Previously these
-- columns existed on recruitment.candidates but had no RPC parameters, so the
-- webhook route (/api/applications) only stashed them in applications.source_metadata
-- JSON — they never reached the candidate record.
-- Migration: 20260810000001_upsert_candidate_linkedin_salary.sql
-- Adds 3 new trailing optional params — backward compatible with existing
-- named-param callers (route.ts, etc).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION recruitment.upsert_candidate(
  p_email                 text,
  p_phone                 text     DEFAULT NULL,
  p_first_name            text     DEFAULT NULL,
  p_last_name             text     DEFAULT NULL,
  p_current_title         text     DEFAULT NULL,
  p_current_employer      text     DEFAULT NULL,
  p_location_city         text     DEFAULT NULL,
  p_location_state        text     DEFAULT NULL,
  p_location_country      text     DEFAULT 'AU',
  p_raw_resume_text       text     DEFAULT NULL,
  p_parsed_metadata       jsonb    DEFAULT NULL,
  p_skills_tags           text[]   DEFAULT NULL,
  p_field_of_study        text     DEFAULT NULL,
  p_source_channel        text     DEFAULT NULL,
  p_added_by              uuid     DEFAULT NULL,
  p_linkedin_url          text     DEFAULT NULL,
  p_current_salary        numeric  DEFAULT NULL,
  p_base_salary_expected  text     DEFAULT NULL
)
RETURNS TABLE (
  candidate_id      uuid,
  action            text,
  completeness_pct  smallint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = recruitment, public
AS $$
DECLARE
  v_id           uuid;
  v_completeness smallint;
BEGIN
  SELECT id INTO v_id
  FROM recruitment.candidates
  WHERE lower(email) = lower(p_email)
     OR (p_phone IS NOT NULL AND phone = p_phone)
     OR (secondary_email IS NOT NULL AND lower(secondary_email) = lower(p_email))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO recruitment.candidates (
      email, phone, first_name, last_name,
      current_title, current_employer,
      location_city, location_state, location_country,
      raw_resume_text, parsed_metadata, skills_tags,
      field_of_study, source_channel, added_by,
      linkedin_url, current_salary, base_salary_expected
    )
    VALUES (
      p_email, p_phone, p_first_name, p_last_name,
      p_current_title, p_current_employer,
      p_location_city, p_location_state, p_location_country,
      p_raw_resume_text, p_parsed_metadata, coalesce(p_skills_tags, '{}'),
      p_field_of_study, p_source_channel, p_added_by,
      p_linkedin_url, p_current_salary, p_base_salary_expected
    )
    RETURNING id INTO v_id;

    action := 'inserted';
  ELSE
    UPDATE recruitment.candidates
    SET
      phone              = COALESCE(phone, p_phone),
      -- Matched by phone/secondary_email but submitted a different primary
      -- email — preserve it as secondary_email instead of dropping it, so
      -- a future submission from that address still resolves here too.
      secondary_email    = CASE
                              WHEN lower(email) = lower(p_email) THEN secondary_email
                              ELSE COALESCE(secondary_email, p_email)
                            END,
      current_title      = COALESCE(current_title, p_current_title),
      current_employer   = COALESCE(current_employer, p_current_employer),
      location_city      = COALESCE(location_city, p_location_city),
      location_state     = COALESCE(location_state, p_location_state),
      raw_resume_text    = COALESCE(raw_resume_text, p_raw_resume_text),
      parsed_metadata    = COALESCE(parsed_metadata, p_parsed_metadata),
      field_of_study     = COALESCE(field_of_study, p_field_of_study),
      linkedin_url       = COALESCE(linkedin_url, p_linkedin_url),
      current_salary     = COALESCE(current_salary, p_current_salary),
      base_salary_expected = COALESCE(base_salary_expected, p_base_salary_expected),
      skills_tags        = CASE
                             WHEN array_length(skills_tags, 1) IS NULL
                             THEN coalesce(p_skills_tags, '{}')
                             ELSE skills_tags
                           END
    WHERE id = v_id;

    action := 'collision_merged';
  END IF;

  -- Completeness: 9 optional fields
  SELECT (
    (CASE WHEN phone IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN current_title IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN current_employer IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN location_city IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN raw_resume_text IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN parsed_metadata IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN array_length(skills_tags, 1) IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN security_clearance_level IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN field_of_study IS NOT NULL THEN 1 ELSE 0 END)
  )::numeric * 100 / 9
  INTO v_completeness
  FROM recruitment.candidates WHERE id = v_id;

  UPDATE recruitment.candidates
  SET profile_completeness_pct = v_completeness::smallint
  WHERE id = v_id;

  candidate_id     := v_id;
  completeness_pct := v_completeness::smallint;
  RETURN NEXT;
END;
$$;
