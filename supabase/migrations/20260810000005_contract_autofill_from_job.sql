-- Position title and contract number can be filled from the job itself —
-- no need to re-type what's already on recruitment.jobs (title,
-- reference_number) every time a contract-type placement is created.
-- Same 15-param... no, same trigger, body-only change: look up the job via
-- NEW.job_id and seed contract_number/position_title from it.
-- Migration: 20260810000005_contract_autofill_from_job.sql

CREATE OR REPLACE FUNCTION recruitment.create_contract_for_placement()
RETURNS trigger AS $$
DECLARE
  v_job_title      text;
  v_job_reference  text;
BEGIN
  IF NEW.placement_type = 'contract' THEN
    SELECT title, reference_number INTO v_job_title, v_job_reference
    FROM recruitment.jobs WHERE id = NEW.job_id;

    INSERT INTO recruitment.contracts (
      placement_id, start_date, finish_date, pay_rate, charge_rate, currency,
      position_title, contract_number
    )
    VALUES (
      NEW.id, NEW.start_date, NEW.finish_date, NEW.pay_rate, NEW.charge_rate, NEW.currency,
      v_job_title, v_job_reference
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';
