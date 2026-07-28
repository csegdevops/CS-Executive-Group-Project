-- ─────────────────────────────────────────────────────────────────────────────
-- Job required skills/education + expanded skill_tag reference data
-- Migration: 20260728000004_job_required_skills_and_skill_taxonomy.sql
-- required_skills / required_education_tags reuse the existing
-- recruitment/skill_tag and recruitment/education_field lookup categories,
-- so candidate matching just compares array overlap — no new categories.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE recruitment.jobs
  ADD COLUMN IF NOT EXISTS required_skills          text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS required_education_tags   text[] NOT NULL DEFAULT '{}';

-- Expanded skill_tag taxonomy — broadens the original 15 (program/project
-- management, defence, core IT) across all practice domains already implied
-- by the existing 16 education_field categories.
INSERT INTO public.lookup_values (scope, category, value, label, sort_order) VALUES
  -- Program & Project Delivery (continuation)
  ('recruitment', 'skill_tag', 'agile_delivery',              'Agile Delivery',                    200),
  ('recruitment', 'skill_tag', 'scrum_master',                'Scrum Mastery',                      210),
  ('recruitment', 'skill_tag', 'portfolio_management',        'Portfolio Management',               220),
  ('recruitment', 'skill_tag', 'procurement_management',      'Procurement Management',             230),
  ('recruitment', 'skill_tag', 'contract_management',         'Contract Management',                240),
  ('recruitment', 'skill_tag', 'quality_assurance',           'Quality Assurance',                  250),
  ('recruitment', 'skill_tag', 'benefits_realisation',        'Benefits Realisation',               260),
  ('recruitment', 'skill_tag', 'scheduling_planning',         'Scheduling & Planning',              270),

  -- Defence & Government
  ('recruitment', 'skill_tag', 'capability_development',      'Capability Development',             300),
  ('recruitment', 'skill_tag', 'military_operations',         'Military Operations',                310),
  ('recruitment', 'skill_tag', 'intelligence_analysis',       'Intelligence Analysis',              320),
  ('recruitment', 'skill_tag', 'logistics_sustainment',       'Logistics & Sustainment',            330),
  ('recruitment', 'skill_tag', 'test_and_evaluation',         'Test & Evaluation',                  340),
  ('recruitment', 'skill_tag', 'security_accreditation',      'Security Accreditation',             350),
  ('recruitment', 'skill_tag', 'export_controls',             'Export Controls (ITAR/DTC)',         360),
  ('recruitment', 'skill_tag', 'through_life_support',        'Through-Life Support',               370),

  -- IT, Software & Cyber
  ('recruitment', 'skill_tag', 'devops',                      'DevOps',                             400),
  ('recruitment', 'skill_tag', 'data_engineering',            'Data Engineering',                   410),
  ('recruitment', 'skill_tag', 'machine_learning',            'Machine Learning / AI',              420),
  ('recruitment', 'skill_tag', 'enterprise_architecture',     'Enterprise Architecture',            430),
  ('recruitment', 'skill_tag', 'it_service_management',       'IT Service Management',              440),
  ('recruitment', 'skill_tag', 'identity_access_management',  'Identity & Access Management',       450),
  ('recruitment', 'skill_tag', 'penetration_testing',         'Penetration Testing',                460),
  ('recruitment', 'skill_tag', 'erp_systems',                 'ERP Systems (SAP/Oracle)',           470),
  ('recruitment', 'skill_tag', 'database_administration',     'Database Administration',            480),

  -- Engineering
  ('recruitment', 'skill_tag', 'mechanical_engineering',      'Mechanical Engineering',             500),
  ('recruitment', 'skill_tag', 'electrical_engineering',      'Electrical Engineering',             510),
  ('recruitment', 'skill_tag', 'civil_engineering',           'Civil Engineering',                  520),
  ('recruitment', 'skill_tag', 'aerospace_engineering',       'Aerospace Engineering',               530),
  ('recruitment', 'skill_tag', 'maritime_engineering',        'Maritime Engineering',               540),
  ('recruitment', 'skill_tag', 'manufacturing_engineering',   'Manufacturing Engineering',          550),
  ('recruitment', 'skill_tag', 'reliability_engineering',     'Reliability Engineering',            560),
  ('recruitment', 'skill_tag', 'environmental_engineering',   'Environmental Engineering',          570),

  -- Business & Commercial
  ('recruitment', 'skill_tag', 'commercial_management',       'Commercial Management',              600),
  ('recruitment', 'skill_tag', 'strategic_planning',          'Strategic Planning',                 610),
  ('recruitment', 'skill_tag', 'mergers_acquisitions',        'Mergers & Acquisitions',              620),
  ('recruitment', 'skill_tag', 'business_development',        'Business Development',               630),
  ('recruitment', 'skill_tag', 'operations_management',       'Operations Management',              640),
  ('recruitment', 'skill_tag', 'supply_chain_management',     'Supply Chain Management',             650),
  ('recruitment', 'skill_tag', 'vendor_management',           'Vendor Management',                  660),
  ('recruitment', 'skill_tag', 'process_improvement',         'Process Improvement',                670),

  -- Policy & Public Administration
  ('recruitment', 'skill_tag', 'government_relations',        'Government Relations',               700),
  ('recruitment', 'skill_tag', 'regulatory_affairs',          'Regulatory Affairs',                 710),
  ('recruitment', 'skill_tag', 'public_sector_governance',    'Public Sector Governance',           720),
  ('recruitment', 'skill_tag', 'grants_administration',       'Grants Administration',              730),
  ('recruitment', 'skill_tag', 'legislation_drafting',        'Legislation & Drafting',             740),

  -- Legal
  ('recruitment', 'skill_tag', 'corporate_law',                'Corporate Law',                     800),
  ('recruitment', 'skill_tag', 'contract_law',                 'Contract Law',                      810),
  ('recruitment', 'skill_tag', 'compliance',                   'Compliance',                        820),
  ('recruitment', 'skill_tag', 'litigation',                   'Litigation',                        830),
  ('recruitment', 'skill_tag', 'intellectual_property',        'Intellectual Property',             840),

  -- Finance & Accounting
  ('recruitment', 'skill_tag', 'financial_analysis',           'Financial Analysis',                900),
  ('recruitment', 'skill_tag', 'financial_planning_analysis',  'Financial Planning & Analysis (FP&A)', 910),
  ('recruitment', 'skill_tag', 'audit',                        'Audit',                              920),
  ('recruitment', 'skill_tag', 'taxation',                     'Taxation',                           930),
  ('recruitment', 'skill_tag', 'treasury',                     'Treasury',                           940),
  ('recruitment', 'skill_tag', 'budgeting_forecasting',        'Budgeting & Forecasting',            950),
  ('recruitment', 'skill_tag', 'cost_accounting',              'Cost Accounting',                    960),

  -- HR & People
  ('recruitment', 'skill_tag', 'talent_acquisition',           'Talent Acquisition',                1000),
  ('recruitment', 'skill_tag', 'workforce_planning',           'Workforce Planning',                1010),
  ('recruitment', 'skill_tag', 'industrial_relations',         'Industrial Relations',              1020),
  ('recruitment', 'skill_tag', 'learning_development',         'Learning & Development',            1030),
  ('recruitment', 'skill_tag', 'remuneration_benefits',        'Remuneration & Benefits',           1040),
  ('recruitment', 'skill_tag', 'organisational_development',   'Organisational Development',        1050),

  -- Science & R&D
  ('recruitment', 'skill_tag', 'research_development',         'Research & Development',            1100),
  ('recruitment', 'skill_tag', 'laboratory_management',        'Laboratory Management',             1110),
  ('recruitment', 'skill_tag', 'data_science',                 'Data Science',                      1120),
  ('recruitment', 'skill_tag', 'chemical_engineering',         'Chemical Engineering',              1130),
  ('recruitment', 'skill_tag', 'biotechnology',                'Biotechnology',                     1140),
  ('recruitment', 'skill_tag', 'environmental_science',        'Environmental Science',             1150),

  -- Communications & Marketing
  ('recruitment', 'skill_tag', 'corporate_communications',     'Corporate Communications',          1200),
  ('recruitment', 'skill_tag', 'public_relations',             'Public Relations',                  1210),
  ('recruitment', 'skill_tag', 'marketing_strategy',           'Marketing Strategy',                1220),
  ('recruitment', 'skill_tag', 'digital_marketing',            'Digital Marketing',                 1230),
  ('recruitment', 'skill_tag', 'stakeholder_engagement',       'Stakeholder Engagement',            1240),
  ('recruitment', 'skill_tag', 'media_relations',              'Media Relations',                   1250),

  -- Design & Architecture
  ('recruitment', 'skill_tag', 'ux_design',                    'UX Design',                         1300),
  ('recruitment', 'skill_tag', 'industrial_design',            'Industrial Design',                 1310),
  ('recruitment', 'skill_tag', 'architectural_design',         'Architectural Design',              1320),
  ('recruitment', 'skill_tag', 'graphic_design',               'Graphic Design',                    1330),

  -- Sales & Business Development
  ('recruitment', 'skill_tag', 'key_account_management',       'Key Account Management',            1400),
  ('recruitment', 'skill_tag', 'sales_leadership',              'Sales Leadership',                 1410),
  ('recruitment', 'skill_tag', 'tender_bid_management',         'Tender & Bid Management',          1420),

  -- Health, Safety & Environment
  ('recruitment', 'skill_tag', 'work_health_safety',            'Work Health & Safety (WHS)',       1500),
  ('recruitment', 'skill_tag', 'environmental_management',      'Environmental Management',         1510),
  ('recruitment', 'skill_tag', 'safety_auditing',               'Safety Auditing',                  1520),
  ('recruitment', 'skill_tag', 'sustainability',                'Sustainability',                   1530),

  -- Executive & Leadership
  ('recruitment', 'skill_tag', 'executive_leadership',          'Executive Leadership',             1600),
  ('recruitment', 'skill_tag', 'board_governance',              'Board & Governance',               1610),
  ('recruitment', 'skill_tag', 'p_and_l_management',            'P&L Management',                   1620),
  ('recruitment', 'skill_tag', 'organisational_transformation', 'Organisational Transformation',    1630)
ON CONFLICT (scope, category, value) DO NOTHING;
