-- Contracts for contract-type placements.
-- A "contractor" is not a new identity — it's just a candidate who has one or
-- more placements with placement_type = 'contract'. Each such placement gets
-- exactly one contracts row (auto-created below), which carries the
-- contract-specific fields placements doesn't (contract number, uploaded
-- document, notice period). Current dates/rates stay on the placement itself
-- (read live, never duplicated) since src/app/api/cron/contract-expiry-check
-- already reads placements.finish_date directly and must keep working.
-- Extensions are full historical records in contract_extensions, not just an
-- audit note — unlike timesheets.contracts (separate schema, external portal
-- login, single contract mutated in place), this needs a real timeline:
-- Initial -> Extension 1 -> Extension 2.

CREATE TABLE recruitment.contracts (
  id                     uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  placement_id           uuid          NOT NULL UNIQUE REFERENCES recruitment.placements(id) ON DELETE CASCADE,
  contract_number        text,
  document_storage_key   text,
  document_original_name text,
  notice_period          text,
  status                 text          NOT NULL DEFAULT 'active'
                           CHECK (status IN ('active', 'expired', 'terminated')),
  termination_reason     text,
  terminated_by          uuid          REFERENCES public.profiles(id) ON DELETE SET NULL,
  terminated_at          timestamptz,
  created_at             timestamptz   NOT NULL DEFAULT now(),
  updated_at             timestamptz   NOT NULL DEFAULT now()
);

CREATE TABLE recruitment.contract_extensions (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id           uuid        NOT NULL REFERENCES recruitment.contracts(id) ON DELETE CASCADE,
  previous_finish_date  date        NOT NULL,
  new_finish_date       date        NOT NULL,
  previous_pay_rate     numeric(10,2),
  new_pay_rate          numeric(10,2),
  previous_charge_rate  numeric(10,2),
  new_charge_rate       numeric(10,2),
  notes                 text,
  extended_by           uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  extended_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_contract_extensions_contract ON recruitment.contract_extensions (contract_id, extended_at DESC);

CREATE TRIGGER contracts_updated_at
  BEFORE UPDATE ON recruitment.contracts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Guarantees every contract-type placement has a contracts row, without any
-- change to the placements POST route or the bulk-create flow.
CREATE OR REPLACE FUNCTION recruitment.create_contract_for_placement()
RETURNS trigger AS $$
BEGIN
  IF NEW.placement_type = 'contract' THEN
    INSERT INTO recruitment.contracts (placement_id) VALUES (NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

CREATE TRIGGER trg_create_contract_for_placement
  AFTER INSERT ON recruitment.placements
  FOR EACH ROW EXECUTE FUNCTION recruitment.create_contract_for_placement();

ALTER TABLE recruitment.contracts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruitment.contract_extensions ENABLE ROW LEVEL SECURITY;

CREATE POLICY recruitment_module_access ON recruitment.contracts
  FOR ALL TO authenticated USING (has_module_access('recruitment'));
CREATE POLICY recruitment_module_access ON recruitment.contract_extensions
  FOR ALL TO authenticated USING (has_module_access('recruitment'));

GRANT SELECT, INSERT, UPDATE, DELETE ON recruitment.contracts, recruitment.contract_extensions TO authenticated, service_role;
