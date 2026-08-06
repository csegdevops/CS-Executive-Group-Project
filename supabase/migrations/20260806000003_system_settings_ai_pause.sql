-- ─────────────────────────────────────────────────────────────────────────────
-- System Settings — global AI pause switch
-- Migration: 20260806000003_system_settings_ai_pause.sql
--
-- Mirrors emails_paused (20260806000002): a super admin can pause every AI
-- call site in one click — CV parsing (src/lib/cv-parsing), formulation
-- upload AI fallback (src/lib/formulation-parsing), and consultation/company
-- AI summaries (src/lib/summarization). Checked fresh per call via
-- isAiPaused() in src/lib/ai/pause.ts, no caching, same as email pause.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.system_settings
  ADD COLUMN ai_paused    boolean NOT NULL DEFAULT false,
  ADD COLUMN ai_paused_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN ai_paused_at timestamptz;
