-- ─────────────────────────────────────────────────────────────────────────────
-- Education tags (controlled vocabulary, parallel to skills_tags) + reference
-- data for both. CV parsing now selects from these fixed lists (enum-
-- constrained on the Gemini side) rather than inventing freeform strings, so
-- CV-sourced candidates become filterable via the same skill/education
-- search recruiters already use — reducing manual re-tagging after parsing.
-- Migration: 20260704000004_candidate_skill_education_tags.sql
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE recruitment.candidates
  ADD COLUMN IF NOT EXISTS education_tags text[] NOT NULL DEFAULT '{}';

-- Broad field-of-study categories — deliberately separate from the existing
-- free-text field_of_study column (which holds the precise degree title,
-- e.g. "Bachelor of Engineering (Mechatronics)"). education_tags is the
-- coarser, filterable counterpart, same relationship as job title vs.
-- skill tags. Editable later via the lookup-values admin UI.
INSERT INTO public.lookup_values (scope, category, value, label, sort_order) VALUES
  ('recruitment', 'education_field', 'engineering',              'Engineering',                 10),
  ('recruitment', 'education_field', 'computer_science',         'Computer Science',             20),
  ('recruitment', 'education_field', 'information_technology',   'Information Technology',       30),
  ('recruitment', 'education_field', 'data_analytics',           'Data Analytics',                40),
  ('recruitment', 'education_field', 'cybersecurity',            'Cybersecurity',                 50),
  ('recruitment', 'education_field', 'business_commerce',        'Business / Commerce',           60),
  ('recruitment', 'education_field', 'project_management',       'Project Management',            70),
  ('recruitment', 'education_field', 'law',                      'Law',                           80),
  ('recruitment', 'education_field', 'science',                  'Science',                       90),
  ('recruitment', 'education_field', 'mathematics_statistics',   'Mathematics / Statistics',      100),
  ('recruitment', 'education_field', 'defence_security_studies', 'Defence / Security Studies',    110),
  ('recruitment', 'education_field', 'design_architecture',      'Design / Architecture',         120),
  ('recruitment', 'education_field', 'communications_media',     'Communications / Media',        130),
  ('recruitment', 'education_field', 'human_resources',          'Human Resources',               140),
  ('recruitment', 'education_field', 'finance_accounting',       'Finance / Accounting',          150),
  ('recruitment', 'education_field', 'public_policy_administration', 'Public Policy / Administration', 160)
ON CONFLICT (scope, category, value) DO NOTHING;
