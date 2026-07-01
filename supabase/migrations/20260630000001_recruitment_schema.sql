-- ─────────────────────────────────────────────────────────────────────────────
-- Recruitment ATS — Core Schema
-- Migration: 20260630000001_recruitment_schema.sql
-- Introduces: candidates, jobs, job_events, applications,
--             application_stage_history, placements, tasks
-- Triggers:   log_application_stage_change, create_placement_tasks
-- Views:      v_stagnant_applications
-- RPCs:       upsert_candidate, search_candidates
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Candidates ──────────────────────────────────────────────────────────────

CREATE TABLE recruitment.candidates (
  id                            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email                         text        NOT NULL UNIQUE,
  phone                         text        UNIQUE,
  first_name                    text        NOT NULL,
  last_name                     text        NOT NULL,
  current_title                 text,
  current_employer              text,
  location_city                 text,
  location_state                text,
  location_country              text        NOT NULL DEFAULT 'AU',
  raw_resume_text               text,
  parsed_metadata               jsonb,
  skills_tags                   text[]      NOT NULL DEFAULT '{}',
  fts_vector                    tsvector    GENERATED ALWAYS AS (
                                  to_tsvector(
                                    'english',
                                    coalesce(first_name, '') || ' ' ||
                                    coalesce(last_name, '') || ' ' ||
                                    coalesce(current_title, '') || ' ' ||
                                    coalesce(current_employer, '') || ' ' ||
                                    coalesce(raw_resume_text, '')
                                  )
                                ) STORED,
  profile_completeness_pct      smallint    NOT NULL DEFAULT 0
                                  CHECK (profile_completeness_pct BETWEEN 0 AND 100),
  completeness_prompted         boolean     NOT NULL DEFAULT false,
  security_clearance_level      text,
  security_clearance_verified   boolean     NOT NULL DEFAULT false,
  security_clearance_expiry     date,
  source_channel                text
                                  CHECK (source_channel IN (
                                    'seek_inbound', 'company_website',
                                    'database_internal', 'seek_talent', 'linkedin'
                                  )),
  cv_parse_status               text        NOT NULL DEFAULT 'unparsed'
                                  CHECK (cv_parse_status IN ('unparsed', 'pending', 'parsed', 'failed')),
  cv_parsed_by                  text
                                  CHECK (cv_parsed_by IN ('gemini', 'claude', 'azure', 'daxtra', 'manual')),
  cv_parsed_at                  timestamptz,
  added_by                      uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_active                     boolean     NOT NULL DEFAULT true,
  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_candidates_fts    ON recruitment.candidates USING GIN (fts_vector);
CREATE INDEX idx_candidates_skills ON recruitment.candidates USING GIN (skills_tags);
CREATE INDEX idx_candidates_email  ON recruitment.candidates (lower(email));

-- ─── Jobs ────────────────────────────────────────────────────────────────────

CREATE TABLE recruitment.jobs (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id                  uuid        NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  title                       text        NOT NULL,
  reference_number            text        UNIQUE,
  description                 text,
  requirements                text,
  employment_type             text        CHECK (employment_type IN ('permanent', 'contract', 'casual')),
  location                    text,
  salary_min                  numeric(12,2),
  salary_max                  numeric(12,2),
  salary_currency             text        NOT NULL DEFAULT 'AUD',
  contract_duration_weeks     integer,
  security_clearance_required boolean     NOT NULL DEFAULT false,
  status                      text        NOT NULL DEFAULT 'opened'
                                CHECK (status IN ('opened', 'posted', 'active', 'paused', 'filled', 'closed')),
  assigned_recruiter_id       uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by                  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

-- ─── Job Events (Timeline) ───────────────────────────────────────────────────
-- Inserted explicitly by API — NOT triggered. Triggers cannot capture
-- the performing user without session variable gymnastics.

CREATE TABLE recruitment.job_events (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id           uuid        NOT NULL REFERENCES recruitment.jobs(id) ON DELETE CASCADE,
  event_type       text        NOT NULL
                     CHECK (event_type IN ('opened', 'posted', 'active', 'paused', 'filled', 'closed', 'note')),
  previous_status  text,
  new_status       text,
  notes            text,
  performed_by     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_job_events_job ON recruitment.job_events (job_id, created_at DESC);

-- ─── Applications ────────────────────────────────────────────────────────────

CREATE TABLE recruitment.applications (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id           uuid        NOT NULL REFERENCES recruitment.jobs(id) ON DELETE RESTRICT,
  candidate_id     uuid        NOT NULL REFERENCES recruitment.candidates(id) ON DELETE RESTRICT,
  source_channel   text        NOT NULL
                     CHECK (source_channel IN (
                       'seek_inbound',       -- [S]  Seek Apply API (direct or via middleware)
                       'company_website',    -- [CS] Google Forms / company career page
                       'database_internal',  -- [DB] Internal talent pool assignment
                       'seek_talent',        -- [ST] Seek Talent Search (manual sourcing)
                       'linkedin'            -- [LI] LinkedIn Search (manual sourcing)
                     )),
  source_metadata  jsonb,
  stage            text        NOT NULL DEFAULT 'applied'
                     CHECK (stage IN (
                       'applied', 'screening', 'shortlisted',
                       'interview_1', 'interview_2', 'reference_check',
                       'offer', 'placed', 'withdrawn', 'rejected'
                     )),
  cv_storage_key   text,
  cl_storage_key   text,
  cv_original_name text,
  cl_original_name text,
  notes            text,
  submitted_by     uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, candidate_id)
);

CREATE INDEX idx_applications_job_id  ON recruitment.applications (job_id);
CREATE INDEX idx_applications_cand_id ON recruitment.applications (candidate_id);
CREATE INDEX idx_applications_stage   ON recruitment.applications (stage, updated_at DESC);

-- ─── Application Stage History (BR-007) ──────────────────────────────────────

CREATE TABLE recruitment.application_stage_history (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id   uuid        NOT NULL REFERENCES recruitment.applications(id) ON DELETE CASCADE,
  from_stage       text,
  to_stage         text        NOT NULL,
  changed_by       uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes            text,
  changed_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_stage_history_app ON recruitment.application_stage_history (application_id, changed_at DESC);

-- ─── Placements (BR-008, BR-009) ─────────────────────────────────────────────

CREATE TABLE recruitment.placements (
  id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id   uuid          NOT NULL UNIQUE REFERENCES recruitment.applications(id) ON DELETE RESTRICT,
  job_id           uuid          NOT NULL REFERENCES recruitment.jobs(id) ON DELETE RESTRICT,
  candidate_id     uuid          NOT NULL REFERENCES recruitment.candidates(id) ON DELETE RESTRICT,
  placement_type   text          NOT NULL CHECK (placement_type IN ('permanent', 'contract')),
  start_date       date          NOT NULL,
  finish_date      date,
  pay_rate         numeric(10,2),
  charge_rate      numeric(10,2),
  currency         text          NOT NULL DEFAULT 'AUD',
  salary_package   numeric(12,2),
  placement_fee    numeric(10,2),
  fee_type         text          CHECK (fee_type IN ('percentage', 'fixed')),
  fee_percentage   numeric(5,2),
  status           text          NOT NULL DEFAULT 'confirmed'
                     CHECK (status IN ('confirmed', 'started', 'completed', 'cancelled')),
  confirmed_by     uuid          REFERENCES public.profiles(id) ON DELETE SET NULL,
  confirmed_at     timestamptz   NOT NULL DEFAULT now(),
  created_at       timestamptz   NOT NULL DEFAULT now(),
  updated_at       timestamptz   NOT NULL DEFAULT now()
);

-- ─── Tasks (BR-008, BR-009, BR-011) ──────────────────────────────────────────

CREATE TABLE recruitment.tasks (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type      text        NOT NULL
                   CHECK (task_type IN (
                     'finance_invoice', 'finance_contract',
                     'security_clearance', 'general'
                   )),
  title          text        NOT NULL,
  description    text,
  placement_id   uuid        REFERENCES recruitment.placements(id) ON DELETE CASCADE,
  job_id         uuid        REFERENCES recruitment.jobs(id) ON DELETE SET NULL,
  candidate_id   uuid        REFERENCES recruitment.candidates(id) ON DELETE SET NULL,
  assigned_to    uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_by    uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  status         text        NOT NULL DEFAULT 'open'
                   CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled')),
  due_date       timestamptz,
  completed_at   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_assignee  ON recruitment.tasks (assigned_to, status);
CREATE INDEX idx_tasks_placement ON recruitment.tasks (placement_id);

-- ─── Updated_at triggers ─────────────────────────────────────────────────────

CREATE TRIGGER candidates_updated_at
  BEFORE UPDATE ON recruitment.candidates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER jobs_updated_at
  BEFORE UPDATE ON recruitment.jobs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER applications_updated_at
  BEFORE UPDATE ON recruitment.applications
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER placements_updated_at
  BEFORE UPDATE ON recruitment.placements
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON recruitment.tasks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── Trigger A: Log application stage transitions ────────────────────────────
-- Fires on UPDATE only. The initial 'applied' entry on INSERT must be
-- inserted explicitly by the API route.

CREATE OR REPLACE FUNCTION recruitment.log_application_stage_change()
RETURNS trigger AS $$
BEGIN
  IF OLD.stage IS DISTINCT FROM NEW.stage THEN
    INSERT INTO recruitment.application_stage_history
      (application_id, from_stage, to_stage, changed_by)
    VALUES
      (NEW.id, OLD.stage, NEW.stage, NULL);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_log_application_stage_change
  AFTER UPDATE ON recruitment.applications
  FOR EACH ROW EXECUTE FUNCTION recruitment.log_application_stage_change();

-- ─── Trigger B: Auto-create tasks on placement (BR-008, BR-009, BR-011) ──────
-- Fires AFTER INSERT only — tasks created once at placement confirmation.
-- assigned_to is NULL; app layer routes to finance team or security officer
-- based on task_type.

CREATE OR REPLACE FUNCTION recruitment.create_placement_tasks()
RETURNS trigger AS $$
BEGIN
  INSERT INTO recruitment.tasks
    (task_type, title, placement_id, job_id, candidate_id, assigned_to)
  VALUES
    ('finance_contract', 'Generate contract for placement', NEW.id, NEW.job_id, NEW.candidate_id, NULL),
    ('finance_invoice',  'Generate invoice for placement',  NEW.id, NEW.job_id, NEW.candidate_id, NULL);

  IF (SELECT security_clearance_required FROM recruitment.jobs WHERE id = NEW.job_id) THEN
    INSERT INTO recruitment.tasks
      (task_type, title, placement_id, job_id, candidate_id, assigned_to)
    VALUES
      ('security_clearance', 'Process security clearance for candidate', NEW.id, NEW.job_id, NEW.candidate_id, NULL);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_create_placement_tasks
  AFTER INSERT ON recruitment.placements
  FOR EACH ROW EXECUTE FUNCTION recruitment.create_placement_tasks();

-- ─── View: Stagnant Applications (BR-007) ────────────────────────────────────
-- Active applications stuck in a stage for > 5 calendar days.
-- Business-day conversion handled in the application layer.

CREATE OR REPLACE VIEW recruitment.v_stagnant_applications AS
SELECT
  a.id             AS application_id,
  a.job_id,
  a.candidate_id,
  a.stage,
  a.updated_at     AS stage_entered_at,
  EXTRACT(EPOCH FROM (now() - a.updated_at)) / 86400 AS days_in_stage,
  j.title          AS job_title,
  c.first_name || ' ' || c.last_name AS candidate_name,
  c.email          AS candidate_email
FROM recruitment.applications a
JOIN recruitment.jobs       j ON j.id = a.job_id
JOIN recruitment.candidates c ON c.id = a.candidate_id
WHERE a.stage NOT IN ('placed', 'withdrawn', 'rejected')
  AND a.updated_at < now() - INTERVAL '5 days'
ORDER BY days_in_stage DESC;

-- ─── RPC: upsert_candidate (BR-004, BR-005) ──────────────────────────────────
-- Deduplication: match on email first, then phone.
-- On collision: COALESCE fills only NULL/empty fields — never overwrites.
-- Recomputes profile_completeness_pct from 8 optional fields (0–100).

CREATE OR REPLACE FUNCTION recruitment.upsert_candidate(
  p_email              text,
  p_phone              text     DEFAULT NULL,
  p_first_name         text     DEFAULT NULL,
  p_last_name          text     DEFAULT NULL,
  p_current_title      text     DEFAULT NULL,
  p_current_employer   text     DEFAULT NULL,
  p_location_city      text     DEFAULT NULL,
  p_location_state     text     DEFAULT NULL,
  p_location_country   text     DEFAULT 'AU',
  p_raw_resume_text    text     DEFAULT NULL,
  p_parsed_metadata    jsonb    DEFAULT NULL,
  p_skills_tags        text[]   DEFAULT NULL,
  p_source_channel     text     DEFAULT NULL,
  p_added_by           uuid     DEFAULT NULL
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
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO recruitment.candidates (
      email, phone, first_name, last_name,
      current_title, current_employer,
      location_city, location_state, location_country,
      raw_resume_text, parsed_metadata, skills_tags,
      source_channel, added_by
    )
    VALUES (
      p_email, p_phone, p_first_name, p_last_name,
      p_current_title, p_current_employer,
      p_location_city, p_location_state, p_location_country,
      p_raw_resume_text, p_parsed_metadata, coalesce(p_skills_tags, '{}'),
      p_source_channel, p_added_by
    )
    RETURNING id INTO v_id;

    action := 'inserted';
  ELSE
    UPDATE recruitment.candidates
    SET
      phone              = COALESCE(phone, p_phone),
      current_title      = COALESCE(current_title, p_current_title),
      current_employer   = COALESCE(current_employer, p_current_employer),
      location_city      = COALESCE(location_city, p_location_city),
      location_state     = COALESCE(location_state, p_location_state),
      raw_resume_text    = COALESCE(raw_resume_text, p_raw_resume_text),
      parsed_metadata    = COALESCE(parsed_metadata, p_parsed_metadata),
      skills_tags        = CASE
                             WHEN array_length(skills_tags, 1) IS NULL
                             THEN coalesce(p_skills_tags, '{}')
                             ELSE skills_tags
                           END
    WHERE id = v_id;

    action := 'collision_merged';
  END IF;

  SELECT (
    (CASE WHEN phone IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN current_title IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN current_employer IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN location_city IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN raw_resume_text IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN parsed_metadata IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN array_length(skills_tags, 1) IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN security_clearance_level IS NOT NULL THEN 1 ELSE 0 END)
  )::numeric * 100 / 8
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

-- ─── RPC: search_candidates (BR-002, FTS) ────────────────────────────────────

CREATE OR REPLACE FUNCTION recruitment.search_candidates(
  query_text  text,
  lim         integer DEFAULT 40
)
RETURNS TABLE (
  id               uuid,
  first_name       text,
  last_name        text,
  email            text,
  current_title    text,
  current_employer text,
  skills_tags      text[],
  rank             real
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = recruitment, public
AS $$
  SELECT
    c.id, c.first_name, c.last_name, c.email,
    c.current_title, c.current_employer, c.skills_tags,
    ts_rank(c.fts_vector, plainto_tsquery('english', query_text)) AS rank
  FROM recruitment.candidates c
  WHERE c.fts_vector @@ plainto_tsquery('english', query_text)
    AND c.is_active = true
  ORDER BY rank DESC
  LIMIT lim;
$$;

-- ─── Row-Level Security ───────────────────────────────────────────────────────

ALTER TABLE recruitment.candidates                ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruitment.jobs                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruitment.job_events                ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruitment.applications              ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruitment.application_stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruitment.placements                ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruitment.tasks                     ENABLE ROW LEVEL SECURITY;

CREATE POLICY recruitment_module_access ON recruitment.candidates
  FOR ALL TO authenticated USING (has_module_access('recruitment'));
CREATE POLICY recruitment_module_access ON recruitment.jobs
  FOR ALL TO authenticated USING (has_module_access('recruitment'));
CREATE POLICY recruitment_module_access ON recruitment.job_events
  FOR ALL TO authenticated USING (has_module_access('recruitment'));
CREATE POLICY recruitment_module_access ON recruitment.applications
  FOR ALL TO authenticated USING (has_module_access('recruitment'));
CREATE POLICY recruitment_module_access ON recruitment.application_stage_history
  FOR ALL TO authenticated USING (has_module_access('recruitment'));
CREATE POLICY recruitment_module_access ON recruitment.placements
  FOR ALL TO authenticated USING (has_module_access('recruitment'));
CREATE POLICY recruitment_module_access ON recruitment.tasks
  FOR ALL TO authenticated USING (has_module_access('recruitment'));

-- ─── Grants ───────────────────────────────────────────────────────────────────

GRANT USAGE ON SCHEMA recruitment TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES    IN SCHEMA recruitment TO authenticated, service_role;
GRANT USAGE, SELECT                  ON ALL SEQUENCES IN SCHEMA recruitment TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA recruitment
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA recruitment
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated, service_role;
