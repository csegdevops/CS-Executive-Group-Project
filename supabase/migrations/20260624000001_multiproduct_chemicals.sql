-- Allow the same chemical to appear in multiple products within one consultation.
-- Previously UNIQUE(consultation_id, chemical_id) prevented this.

-- Backfill nulls before adding NOT NULL
UPDATE regulatory.consultation_chemicals SET product_name = '' WHERE product_name IS NULL;

ALTER TABLE regulatory.consultation_chemicals
  ALTER COLUMN product_name SET NOT NULL,
  ALTER COLUMN product_name SET DEFAULT '';

-- Swap unique constraint to include product_name
ALTER TABLE regulatory.consultation_chemicals
  DROP CONSTRAINT consultation_chemicals_consultation_id_chemical_id_key;

ALTER TABLE regulatory.consultation_chemicals
  ADD CONSTRAINT consultation_chemicals_consultation_product_chemical_key
  UNIQUE (consultation_id, chemical_id, product_name);
