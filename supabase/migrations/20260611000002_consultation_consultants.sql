-- Assigns one or more consultants to a specific consultation.
-- Complements consultant_company_assignments (company-level) with a
-- consultation-level link so individual jobs can have multiple assignees.

CREATE TABLE IF NOT EXISTS regulatory.consultation_consultants (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  consultation_id uuid NOT NULL REFERENCES regulatory.consultations(id) ON DELETE CASCADE,
  consultant_id   uuid NOT NULL REFERENCES public.profiles(id)          ON DELETE CASCADE,
  assigned_at     timestamptz DEFAULT now(),
  assigned_by     uuid REFERENCES public.profiles(id),
  UNIQUE (consultation_id, consultant_id)
);

ALTER TABLE regulatory.consultation_consultants ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE regulatory.consultation_consultants TO service_role;
GRANT SELECT, INSERT, DELETE ON TABLE regulatory.consultation_consultants TO authenticated;

CREATE POLICY "cc_consultants_select" ON regulatory.consultation_consultants
  FOR SELECT USING (is_module_admin('regulatory') OR consultant_id = auth.uid());

CREATE POLICY "cc_consultants_insert" ON regulatory.consultation_consultants
  FOR INSERT WITH CHECK (is_module_admin('regulatory'));

CREATE POLICY "cc_consultants_delete" ON regulatory.consultation_consultants
  FOR DELETE USING (is_module_admin('regulatory'));
