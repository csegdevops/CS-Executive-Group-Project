CREATE TABLE regulatory.consultation_notes (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id  uuid        NOT NULL REFERENCES regulatory.consultations(id) ON DELETE CASCADE,
  author_id        uuid        NOT NULL,
  content          text        NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON regulatory.consultation_notes(consultation_id);

ALTER TABLE regulatory.consultation_notes ENABLE ROW LEVEL SECURITY;

-- Service role (used by all API routes) bypasses RLS; no authenticated-key access is needed.
GRANT ALL ON regulatory.consultation_notes TO service_role;
