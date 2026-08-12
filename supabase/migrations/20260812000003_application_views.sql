-- ─────────────────────────────────────────────────────────────────────────────
-- application_views: tracks which recruiters have opened an application.
-- One row per (application, recruiter) — the primary key itself enforces
-- "first view only" (re-opening does not add rows or move viewed_at).
-- "Unviewed" is simply "no rows exist for this application_id yet"; the
-- highlight this drives in the UI is global (clears for everyone once any
-- one row exists), while the row list itself lets recruiters see *who* has
-- viewed it. Private/service-role-only, same pattern as job_documents and
-- candidate_documents — all access goes through the admin client in API
-- routes, not client-side Supabase calls.
-- Migration: 20260812000003_application_views.sql
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE recruitment.application_views (
  application_id uuid        NOT NULL REFERENCES recruitment.applications(id) ON DELETE CASCADE,
  viewed_by      uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewed_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (application_id, viewed_by)
);

CREATE INDEX ON recruitment.application_views(application_id);

ALTER TABLE recruitment.application_views ENABLE ROW LEVEL SECURITY;
GRANT ALL ON recruitment.application_views TO service_role;
