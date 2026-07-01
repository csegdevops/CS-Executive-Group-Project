-- Add vacancies_count to recruitment.jobs
ALTER TABLE recruitment.jobs
  ADD COLUMN IF NOT EXISTS vacancies_count integer NOT NULL DEFAULT 1
    CHECK (vacancies_count >= 1);

-- Expand employment_type CHECK to include full_time and part_time
ALTER TABLE recruitment.jobs
  DROP CONSTRAINT IF EXISTS jobs_employment_type_check;

ALTER TABLE recruitment.jobs
  ADD CONSTRAINT jobs_employment_type_check
    CHECK (employment_type IN ('permanent', 'contract', 'casual', 'full_time', 'part_time'));

-- Add timesheets scope to lookup_values
ALTER TABLE public.lookup_values
  DROP CONSTRAINT IF EXISTS lookup_values_scope_check;

ALTER TABLE public.lookup_values
  ADD CONSTRAINT lookup_values_scope_check
    CHECK (scope IN ('global', 'regulatory', 'recruitment', 'crm', 'timesheets'));
