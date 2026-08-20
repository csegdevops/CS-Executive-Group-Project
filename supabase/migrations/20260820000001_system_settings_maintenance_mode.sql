-- ─────────────────────────────────────────────────────────────────────────────
-- System Settings — maintenance mode
-- Migration: 20260820000001_system_settings_maintenance_mode.sql
--
-- When enabled, only super_admins can use the portal — everyone else
-- (unauthenticated visitors, regular staff, and timesheets contractors/
-- supervisors on the external portal) is shown a maintenance page instead.
-- Enforced in src/proxy.ts (page navigation only, not RLS — this is a
-- routing gate, not a data-access one; API routes are unaffected).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.system_settings
  ADD COLUMN maintenance_mode    boolean NOT NULL DEFAULT false,
  ADD COLUMN maintenance_mode_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN maintenance_mode_at timestamptz;
