-- Add 'ec_number' as a valid alias_type for EC / List numbers from ECHA SVHC imports.
-- Drops and recreates the CHECK constraint (PostgreSQL requires this to alter it).
ALTER TABLE regulatory.chemical_aliases
  DROP CONSTRAINT IF EXISTS chemical_aliases_alias_type_check;

ALTER TABLE regulatory.chemical_aliases
  ADD CONSTRAINT chemical_aliases_alias_type_check
  CHECK (alias_type IN ('trade_name', 'synonym', 'iupac', 'cas_rn', 'ec_number'));
