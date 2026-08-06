-- ─────────────────────────────────────────────────────────────────────────────
-- Timesheets Portal — Core Schema
-- Migration: 20260806000001_timesheets_schema.sql
-- Introduces: profiles.user_type (internal | contractor | supervisor),
--             timesheets.{contractors, supervisors, supervisor_assignments,
--             contracts, contract_events, timesheets, timesheet_entries,
--             timesheet_events}, contacts.is_timesheets_supervisor
--
-- Unlike regulatory/recruitment (internal-staff-only, flat module-permission
-- RLS), Timesheets introduces two external user types — contractors and
-- client-side supervisors — who must only ever see their own rows. RLS here
-- is row-owner scoped, not permission-key scoped, and these tables carry
-- only SELECT policies for `authenticated`: all writes go through API routes
-- using the service-role client (same convention as consultation_notes /
-- user_groups), which bypasses RLS and enforces ownership in application code.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE SCHEMA IF NOT EXISTS timesheets;

-- ─── profiles.user_type — the internal/external axis ─────────────────────────
-- Additive only: default 'internal' preserves every existing user's behavior.

ALTER TABLE public.profiles ADD COLUMN user_type text NOT NULL DEFAULT 'internal'
  CHECK (user_type IN ('internal', 'contractor', 'supervisor'));

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, user_type)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    COALESCE(NEW.raw_user_meta_data->>'user_type', 'internal')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Contractor/supervisor accounts must never land in "Regulatory Member" —
-- they get zero permission-catalog grants, ever.
CREATE OR REPLACE FUNCTION grant_default_module_access()
RETURNS trigger AS $$
BEGIN
  IF NEW.user_type <> 'internal' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.user_group_members (group_id, user_id)
  SELECT id, NEW.id FROM public.user_groups WHERE name = 'Regulatory Member'
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- ─── module_config: widen to allow 'timesheets' + seed it ────────────────────

ALTER TABLE public.module_config
  DROP CONSTRAINT module_config_module_check,
  ADD CONSTRAINT module_config_module_check
    CHECK (module IN ('regulatory', 'recruitment', 'timesheets'));

INSERT INTO public.module_config (module) VALUES ('timesheets')
  ON CONFLICT (module) DO NOTHING;

-- ─── contacts: supervisor tagging (same boolean-flag family as is_primary /
-- is_crm_contact / is_regulatory_contact / is_recruitment_contact) ───────────

ALTER TABLE public.contacts ADD COLUMN is_timesheets_supervisor boolean NOT NULL DEFAULT false;

-- Internal Timesheets staff need to browse/tag company contacts and branches
-- from the back-office (picking/creating a supervisor), same as regulatory
-- and recruitment staff already can.
ALTER POLICY contacts_authenticated ON public.contacts
  USING (
    (select has_module_access('regulatory'))
    OR (select has_module_access('recruitment'))
    OR (select has_module_access('timesheets'))
  )
  WITH CHECK (
    (select has_module_access('regulatory'))
    OR (select has_module_access('recruitment'))
    OR (select has_module_access('timesheets'))
  );

ALTER POLICY branches_authenticated ON public.company_branches
  USING (
    (select has_module_access('regulatory'))
    OR (select has_module_access('recruitment'))
    OR (select has_module_access('timesheets'))
  )
  WITH CHECK (
    (select has_module_access('regulatory'))
    OR (select has_module_access('recruitment'))
    OR (select has_module_access('timesheets'))
  );

-- ─── Contractors ───────────────────────────────────────────────────────────
-- One row per contractor login. user_id/email are denormalized off auth.users
-- at provisioning time so the roster can render without an admin.getUserById
-- call per row (same reasoning as recruitment.candidates.email).

CREATE TABLE timesheets.contractors (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  candidate_id uuid        REFERENCES recruitment.candidates(id) ON DELETE SET NULL,
  placement_id uuid        REFERENCES recruitment.placements(id) ON DELETE SET NULL,
  company_id   uuid        NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  branch_id    uuid        REFERENCES public.company_branches(id) ON DELETE SET NULL,
  full_name    text        NOT NULL,
  email        text        NOT NULL UNIQUE,
  is_active    boolean     NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_contractors_company ON timesheets.contractors (company_id);

-- ─── Supervisors ─────────────────────────────────────────────────────────────
-- contact_id links back to the tagged public.contacts row for company-side
-- display; nullable in case the login is provisioned before the contact
-- record exists (created together in practice, via the same API route).

CREATE TABLE timesheets.supervisors (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  contact_id   uuid        UNIQUE REFERENCES public.contacts(id) ON DELETE SET NULL,
  company_id   uuid        NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  branch_id    uuid        REFERENCES public.company_branches(id) ON DELETE SET NULL,
  full_name    text        NOT NULL,
  email        text        NOT NULL UNIQUE,
  is_active    boolean     NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_supervisors_company ON timesheets.supervisors (company_id);

-- ─── Supervisor Assignments ──────────────────────────────────────────────────
-- Time-bound many-to-many: a contractor's supervisor can change (cover,
-- reassignment) — changing it closes the active row (end_date = now()) and
-- inserts a new one, rather than overwriting a single FK.

CREATE TABLE timesheets.supervisor_assignments (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id  uuid        NOT NULL REFERENCES timesheets.contractors(id) ON DELETE CASCADE,
  supervisor_id  uuid        NOT NULL REFERENCES timesheets.supervisors(id) ON DELETE CASCADE,
  start_date     date        NOT NULL DEFAULT current_date,
  end_date       date,
  assigned_by    uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_supervisor_assignments_contractor ON timesheets.supervisor_assignments (contractor_id, end_date);
CREATE INDEX idx_supervisor_assignments_supervisor ON timesheets.supervisor_assignments (supervisor_id, end_date);

-- Only one *active* (end_date IS NULL) assignment per contractor at a time.
CREATE UNIQUE INDEX idx_supervisor_assignments_one_active
  ON timesheets.supervisor_assignments (contractor_id) WHERE end_date IS NULL;

-- ─── Contracts ───────────────────────────────────────────────────────────────
-- Current-state row per contractor engagement. Extensions/renewals update
-- this same row (per spec: "not necessarily a new record") — the change is
-- logged via contract_events rather than a new contract row.

CREATE TABLE timesheets.contracts (
  id             uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id  uuid          NOT NULL UNIQUE REFERENCES timesheets.contractors(id) ON DELETE CASCADE,
  start_date     date          NOT NULL,
  finish_date    date,
  pay_rate       numeric(10,2),
  charge_rate    numeric(10,2),
  currency       text          NOT NULL DEFAULT 'AUD',
  status         text          NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active', 'expired', 'terminated')),
  created_at     timestamptz   NOT NULL DEFAULT now(),
  updated_at     timestamptz   NOT NULL DEFAULT now()
);

-- ─── Contract Events (audit log) ──────────────────────────────────────────────
-- Explicit-insert pattern, same as recruitment.job_events / consultation_logs
-- — a trigger can't capture the acting user without session-variable tricks.

CREATE TABLE timesheets.contract_events (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id    uuid        NOT NULL REFERENCES timesheets.contracts(id) ON DELETE CASCADE,
  event_type     text        NOT NULL
                   CHECK (event_type IN ('created', 'extended', 'terminated', 'supervisor_changed')),
  actor_user_id  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  details        jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_contract_events_contract ON timesheets.contract_events (contract_id, created_at DESC);

-- ─── Timesheets ────────────────────────────────────────────────────────────
-- State machine: draft -> submitted -> approved | declined -> (amend) ->
-- submitted -> ... `is_template` rows are drafts that are never submitted,
-- duplicated into a new week via the app layer to avoid rebuilding recurring
-- daily entries from scratch.

CREATE TABLE timesheets.timesheets (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id  uuid        NOT NULL REFERENCES timesheets.contractors(id) ON DELETE CASCADE,
  week_starting  date        NOT NULL,
  status         text        NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'submitted', 'approved', 'declined')),
  decline_reason text,
  is_template    boolean     NOT NULL DEFAULT false,
  supervisor_id  uuid        REFERENCES timesheets.supervisors(id) ON DELETE SET NULL,
  submitted_at   timestamptz,
  approved_at    timestamptz,
  approved_by    uuid        REFERENCES timesheets.supervisors(id) ON DELETE SET NULL,
  declined_at    timestamptz,
  declined_by    uuid        REFERENCES timesheets.supervisors(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_timesheets_contractor ON timesheets.timesheets (contractor_id, week_starting DESC);
CREATE INDEX idx_timesheets_supervisor ON timesheets.timesheets (supervisor_id, status);

-- A contractor has at most one real (non-template) timesheet per week.
CREATE UNIQUE INDEX idx_timesheets_one_per_week
  ON timesheets.timesheets (contractor_id, week_starting) WHERE is_template = false;

-- ─── Timesheet Entries ───────────────────────────────────────────────────────

CREATE TABLE timesheets.timesheet_entries (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  timesheet_id  uuid        NOT NULL REFERENCES timesheets.timesheets(id) ON DELETE CASCADE,
  work_date     date        NOT NULL,
  hours         numeric(4,2) NOT NULL CHECK (hours >= 0 AND hours <= 24),
  description   text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (timesheet_id, work_date)
);

-- ─── Timesheet Events (Timeline / approval audit log) ────────────────────────

CREATE TABLE timesheets.timesheet_events (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  timesheet_id   uuid        NOT NULL REFERENCES timesheets.timesheets(id) ON DELETE CASCADE,
  event_type     text        NOT NULL
                   CHECK (event_type IN ('submitted', 'approved', 'declined', 'amended', 'resubmitted')),
  actor_user_id  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_timesheet_events_timesheet ON timesheets.timesheet_events (timesheet_id, created_at DESC);

-- ─── updated_at triggers ───────────────────────────────────────────────────

CREATE TRIGGER contractors_updated_at
  BEFORE UPDATE ON timesheets.contractors
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER supervisors_updated_at
  BEFORE UPDATE ON timesheets.supervisors
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER contracts_updated_at
  BEFORE UPDATE ON timesheets.contracts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER timesheets_updated_at
  BEFORE UPDATE ON timesheets.timesheets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── Row-Level Security ───────────────────────────────────────────────────────
-- SELECT-only for `authenticated` — row ownership, not module-permission,
-- scoped. All writes happen via API routes on the service-role client, which
-- bypasses RLS entirely and enforces ownership/authorization in code.

ALTER TABLE timesheets.contractors             ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheets.supervisors              ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheets.supervisor_assignments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheets.contracts                ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheets.contract_events          ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheets.timesheets               ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheets.timesheet_entries        ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheets.timesheet_events         ENABLE ROW LEVEL SECURITY;

CREATE POLICY timesheets_contractors_select ON timesheets.contractors
  FOR SELECT TO authenticated USING (
    user_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM timesheets.supervisor_assignments sa
      JOIN timesheets.supervisors s ON s.id = sa.supervisor_id
      WHERE sa.contractor_id = contractors.id AND s.user_id = (select auth.uid()) AND sa.end_date IS NULL
    )
    OR (select is_module_admin('timesheets'))
  );

CREATE POLICY timesheets_supervisors_select ON timesheets.supervisors
  FOR SELECT TO authenticated USING (
    user_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM timesheets.supervisor_assignments sa
      JOIN timesheets.contractors c ON c.id = sa.contractor_id
      WHERE sa.supervisor_id = supervisors.id AND c.user_id = (select auth.uid()) AND sa.end_date IS NULL
    )
    OR (select is_module_admin('timesheets'))
  );

CREATE POLICY timesheets_supervisor_assignments_select ON timesheets.supervisor_assignments
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM timesheets.contractors c WHERE c.id = supervisor_assignments.contractor_id AND c.user_id = (select auth.uid()))
    OR EXISTS (SELECT 1 FROM timesheets.supervisors s WHERE s.id = supervisor_assignments.supervisor_id AND s.user_id = (select auth.uid()))
    OR (select is_module_admin('timesheets'))
  );

CREATE POLICY timesheets_contracts_select ON timesheets.contracts
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM timesheets.contractors c WHERE c.id = contracts.contractor_id AND c.user_id = (select auth.uid()))
    OR EXISTS (
      SELECT 1 FROM timesheets.supervisor_assignments sa
      JOIN timesheets.supervisors s ON s.id = sa.supervisor_id
      WHERE sa.contractor_id = contracts.contractor_id AND s.user_id = (select auth.uid()) AND sa.end_date IS NULL
    )
    OR (select is_module_admin('timesheets'))
  );

CREATE POLICY timesheets_contract_events_select ON timesheets.contract_events
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM timesheets.contracts co
      JOIN timesheets.contractors c ON c.id = co.contractor_id
      WHERE co.id = contract_events.contract_id AND c.user_id = (select auth.uid())
    )
    OR (select is_module_admin('timesheets'))
  );

CREATE POLICY timesheets_timesheets_select ON timesheets.timesheets
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM timesheets.contractors c WHERE c.id = timesheets.contractor_id AND c.user_id = (select auth.uid()))
    OR EXISTS (SELECT 1 FROM timesheets.supervisors s WHERE s.id = timesheets.supervisor_id AND s.user_id = (select auth.uid()))
    OR (select is_module_admin('timesheets'))
  );

CREATE POLICY timesheets_timesheet_entries_select ON timesheets.timesheet_entries
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM timesheets.timesheets t
      JOIN timesheets.contractors c ON c.id = t.contractor_id
      WHERE t.id = timesheet_entries.timesheet_id AND c.user_id = (select auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM timesheets.timesheets t
      JOIN timesheets.supervisors s ON s.id = t.supervisor_id
      WHERE t.id = timesheet_entries.timesheet_id AND s.user_id = (select auth.uid())
    )
    OR (select is_module_admin('timesheets'))
  );

CREATE POLICY timesheets_timesheet_events_select ON timesheets.timesheet_events
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM timesheets.timesheets t
      JOIN timesheets.contractors c ON c.id = t.contractor_id
      WHERE t.id = timesheet_events.timesheet_id AND c.user_id = (select auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM timesheets.timesheets t
      JOIN timesheets.supervisors s ON s.id = t.supervisor_id
      WHERE t.id = timesheet_events.timesheet_id AND s.user_id = (select auth.uid())
    )
    OR (select is_module_admin('timesheets'))
  );

-- ─── Grants ───────────────────────────────────────────────────────────────────
-- SELECT only for `authenticated` (writes are service-role/API-route only —
-- there is no INSERT/UPDATE/DELETE policy for `authenticated` above, so
-- granting those verbs would be a no-op today, but omitting them keeps that
-- guarantee robust against future policy additions).

GRANT USAGE ON SCHEMA timesheets TO authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA timesheets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA timesheets TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA timesheets TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA timesheets GRANT SELECT ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA timesheets GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA timesheets GRANT USAGE, SELECT ON SEQUENCES TO authenticated, service_role;

-- ─── get_own_auth_context(): surface user_type so the app can branch without
-- an extra round trip ───────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.get_own_auth_context();

CREATE FUNCTION public.get_own_auth_context()
RETURNS TABLE (
  role text,
  full_name text,
  user_type text,
  permission_keys text[],
  enabled_modules text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT
    p.role,
    p.full_name,
    p.user_type,
    COALESCE((
      SELECT array_agg(DISTINCT perm.permission_key)
      FROM public.user_group_members mem
      JOIN public.user_group_permissions perm ON perm.group_id = mem.group_id
      WHERE mem.user_id = p.id
    ), '{}'::text[]) AS permission_keys,
    COALESCE((
      SELECT array_agg(mc.module)
      FROM public.module_config mc
      WHERE mc.is_enabled = true
    ), '{}'::text[]) AS enabled_modules
  FROM public.profiles p
  WHERE p.id = (select auth.uid());
$function$;

REVOKE ALL ON FUNCTION public.get_own_auth_context() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_own_auth_context() TO authenticated;
