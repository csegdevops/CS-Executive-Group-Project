-- ─────────────────────────────────────────────────────────────────────────────
-- Contract renewals + full rate/terms/schedule capture.
--
-- Previously recruitment.contracts.placement_id was UNIQUE — exactly one
-- contract per placement, ever. Extensions (contract_extensions) only ever
-- pushed the finish date/rate on that single row. Real-world usage draws a
-- distinction the old single-row model can't express: an "extension" only
-- pushes the finish date (same rate/terms), while a "renewal" is a genuinely
-- new contract under the same job — rate, award, working hours, everything
-- can differ. This migration makes contracts one-to-many per placement:
-- is_current + a partial unique index replace the old blanket UNIQUE, and
-- each contract period now carries its own dates/rates/terms instead of
-- relying solely on the placement's single denormalized values.
--
-- placements.start_date/finish_date/pay_rate/charge_rate remain the "live"
-- mirror that src/app/api/cron/contract-expiry-check and list queries read
-- directly — Extend/Renew keep them in sync, same principle the original
-- Extend flow already used.
-- Migration: 20260810000002_contract_renewals_and_terms.sql
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE recruitment.contracts DROP CONSTRAINT contracts_placement_id_key;

ALTER TABLE recruitment.contracts
  ADD COLUMN is_current boolean NOT NULL DEFAULT true;

-- Per-contract-period snapshot (backfilled from the linked placement below).
ALTER TABLE recruitment.contracts
  ADD COLUMN start_date   date,
  ADD COLUMN finish_date  date,
  ADD COLUMN pay_rate     numeric(10,2),
  ADD COLUMN charge_rate  numeric(10,2),
  ADD COLUMN currency     text NOT NULL DEFAULT 'AUD';

UPDATE recruitment.contracts c
SET start_date  = p.start_date,
    finish_date = p.finish_date,
    pay_rate    = p.pay_rate,
    charge_rate = p.charge_rate,
    currency    = p.currency
FROM recruitment.placements p
WHERE p.id = c.placement_id;

-- Rate & Terms of Business + Contract Details + Working Hours (all belong to
-- a specific contract period, so a renewal can freely change any of them).
ALTER TABLE recruitment.contracts
  ADD COLUMN award                          text,
  ADD COLUMN award_level                    text,
  ADD COLUMN factor_rate                    numeric(6,3),
  ADD COLUMN pay_rate_excl_casual_loading   numeric(10,2),
  ADD COLUMN payment_terms_days             integer,
  ADD COLUMN overtime_applicable            boolean NOT NULL DEFAULT false,
  ADD COLUMN po_required                    boolean NOT NULL DEFAULT false,
  ADD COLUMN position_title                 text,
  ADD COLUMN safety_course_required         boolean NOT NULL DEFAULT false,
  ADD COLUMN view_to_extend                 boolean NOT NULL DEFAULT false,
  ADD COLUMN permanent_conversion_status    text NOT NULL DEFAULT 'not_notified'
                                              CHECK (permanent_conversion_status IN
                                                ('not_notified', 'notified', 'converted', 'declined', 'not_applicable')),
  ADD COLUMN next_award_review_date         date,
  ADD COLUMN reporting_contact_name         text,
  ADD COLUMN reporting_contact_email        text,
  ADD COLUMN work_attire_ppe                text,
  ADD COLUMN actual_finish_date             date,
  ADD COLUMN last_payment_date              date,
  ADD COLUMN working_hours                  jsonb,
  ADD COLUMN lunch_break_minutes            integer,
  ADD COLUMN start_time_first_day           time,
  ADD COLUMN recruitment_agreement_contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  ADD COLUMN invoicing_contact_id             uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  ADD COLUMN timesheet_approver_contact_id    uuid REFERENCES public.contacts(id) ON DELETE SET NULL;

-- Exactly one current contract per placement at a time — replaces the old
-- blanket UNIQUE(placement_id).
CREATE UNIQUE INDEX contracts_one_current_per_placement
  ON recruitment.contracts (placement_id) WHERE is_current;

CREATE INDEX idx_contracts_placement ON recruitment.contracts (placement_id);

-- Auto-create trigger now also seeds the contract period's own dates/rates
-- from the placement it was created for.
CREATE OR REPLACE FUNCTION recruitment.create_contract_for_placement()
RETURNS trigger AS $$
BEGIN
  IF NEW.placement_type = 'contract' THEN
    INSERT INTO recruitment.contracts (placement_id, start_date, finish_date, pay_rate, charge_rate, currency)
    VALUES (NEW.id, NEW.start_date, NEW.finish_date, NEW.pay_rate, NEW.charge_rate, NEW.currency);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';
