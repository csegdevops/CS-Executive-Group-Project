-- Scheduled "unsuccessful candidate" emails.
-- One row per (job, application) a recruiter has chosen to notify once a job
-- is filled. Date-only scheduling (no time-of-day) — a daily cron
-- (send-scheduled-application-emails) sends everything with
-- scheduled_for <= current_date and status = 'pending'.

CREATE TABLE recruitment.scheduled_emails (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id         uuid        NOT NULL REFERENCES recruitment.jobs(id) ON DELETE RESTRICT,
  application_id uuid        NOT NULL REFERENCES recruitment.applications(id) ON DELETE RESTRICT,
  candidate_id   uuid        NOT NULL REFERENCES recruitment.candidates(id) ON DELETE RESTRICT,
  task_id        uuid        REFERENCES recruitment.tasks(id) ON DELETE SET NULL,
  scheduled_for  date        NOT NULL,
  status         text        NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'sent', 'cancelled', 'failed')),
  sent_at        timestamptz,
  error_message  text,
  created_by     uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_scheduled_emails_due         ON recruitment.scheduled_emails (status, scheduled_for);
CREATE INDEX idx_scheduled_emails_job         ON recruitment.scheduled_emails (job_id);
CREATE INDEX idx_scheduled_emails_application ON recruitment.scheduled_emails (application_id);

CREATE TRIGGER scheduled_emails_updated_at
  BEFORE UPDATE ON recruitment.scheduled_emails
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE recruitment.scheduled_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY recruitment_module_access ON recruitment.scheduled_emails
  FOR ALL TO authenticated USING (has_module_access('recruitment'));

GRANT SELECT, INSERT, UPDATE, DELETE ON recruitment.scheduled_emails TO authenticated, service_role;
