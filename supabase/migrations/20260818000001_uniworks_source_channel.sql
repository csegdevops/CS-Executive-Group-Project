-- ─────────────────────────────────────────────────────────────────────────────
-- Add 'uniworks' as a distinct source_channel value, so candidates pushed in
-- from the UniWorks student-matching platform are visibly tagged rather than
-- folded into the generic 'database_internal' code.
-- Migration: 20260818000001_uniworks_source_channel.sql
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE recruitment.candidates
  DROP CONSTRAINT candidates_source_channel_check,
  ADD CONSTRAINT candidates_source_channel_check
    CHECK (source_channel IN (
      'seek_inbound', 'company_website', 'database_internal',
      'seek_talent', 'linkedin', 'uniworks'
    ));

ALTER TABLE recruitment.applications
  DROP CONSTRAINT applications_source_channel_check,
  ADD CONSTRAINT applications_source_channel_check
    CHECK (source_channel IN (
      'seek_inbound', 'company_website', 'database_internal',
      'seek_talent', 'linkedin', 'uniworks'
    ));
