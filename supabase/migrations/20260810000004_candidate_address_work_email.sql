-- Street address and work email — suburb/state/postcode already exist as
-- location_city/state/postcode; citizenship_status already covers visa
-- status (work_visa/student_visa/working_holiday/etc, see
-- 20260704000002_candidate_profile_fields.sql).
-- Migration: 20260810000004_candidate_address_work_email.sql

ALTER TABLE recruitment.candidates
  ADD COLUMN address_line text,
  ADD COLUMN work_email   text;
