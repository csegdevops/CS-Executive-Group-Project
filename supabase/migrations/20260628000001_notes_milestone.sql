ALTER TABLE regulatory.consultation_notes
  ADD COLUMN milestone text CHECK (
    milestone IN ('consultation', 'chemicals', 'volumes', 'regulatory', 'review', 'complete')
  );
