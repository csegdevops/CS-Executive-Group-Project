-- Allow consultation_chemicals to hold unresolved (client-uploaded but unmatched) rows.
-- NULL chemical_id = ingredient from client file not matched to any DB chemical.
-- The UNIQUE(consultation_id, chemical_id) constraint still prevents duplicate matched rows
-- (PostgreSQL UNIQUE does NOT consider two NULLs as equal, so NULL rows can coexist).
alter table regulatory.consultation_chemicals
  alter column chemical_id drop not null;
