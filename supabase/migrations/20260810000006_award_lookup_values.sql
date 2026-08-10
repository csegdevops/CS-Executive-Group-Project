-- Award / Award Level become real dropdowns instead of free text — seeded
-- with the Professional Employees Award (Scientists) classification
-- structure CSEG actually places against.
-- Migration: 20260810000006_award_lookup_values.sql

INSERT INTO lookup_values (scope, category, value, label, sort_order) VALUES
  ('recruitment', 'award', 'professional_employees_award', 'Professional Employees Award', 10)
ON CONFLICT (scope, category, value) DO NOTHING;

INSERT INTO lookup_values (scope, category, value, label, sort_order) VALUES
  ('recruitment', 'award_level', 'gp1_pp1_1_3yr',           'Graduate Professional Level 1, pay point 1.1 - 3 year degree',        10),
  ('recruitment', 'award_level', 'gp1_pp1_1_4or5yr',        'Graduate Professional Level 1, pay point 1.1 - 4 or 5 year degree',   20),
  ('recruitment', 'award_level', 'gp1_pp1_2',                'Graduate Professional Level 1, pay point 1.2',                        30),
  ('recruitment', 'award_level', 'gp1_pp1_3',                'Graduate Professional Level 1, pay point 1.3',                        40),
  ('recruitment', 'award_level', 'gp1_pp1_4',                'Graduate Professional Level 1, pay point 1.4',                        50),
  ('recruitment', 'award_level', 'experienced_scientist_l2', 'Experienced Scientist Level 2',                                       60),
  ('recruitment', 'award_level', 'quality_auditor_l2',       'Quality Auditor Level 2',                                             70),
  ('recruitment', 'award_level', 'professional_l3',          'Professional Level 3',                                                80),
  ('recruitment', 'award_level', 'senior_quality_auditor_l3','Senior Quality Auditor Level 3',                                      90),
  ('recruitment', 'award_level', 'professional_l4',          'Professional Level 4',                                               100)
ON CONFLICT (scope, category, value) DO NOTHING;
