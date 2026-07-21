-- ─── Regulatory: Consultations — missing indexes ──────────────────────────────
-- company_id (FK, filtered on company detail page, admin/companies) and status
-- (filtered on dashboard, analytics) had no index despite being the busiest
-- table in the regulatory module.

CREATE INDEX IF NOT EXISTS idx_consultations_company ON regulatory.consultations (company_id);
CREATE INDEX IF NOT EXISTS idx_consultations_status  ON regulatory.consultations (status);
