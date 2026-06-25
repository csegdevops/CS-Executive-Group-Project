ALTER TABLE regulatory.chemicals
  ADD COLUMN IF NOT EXISTS source varchar(60) NULL;

COMMENT ON COLUMN regulatory.chemicals.source IS 'Origin of the chemical record, e.g. chemskill, pubchem, aicis';
