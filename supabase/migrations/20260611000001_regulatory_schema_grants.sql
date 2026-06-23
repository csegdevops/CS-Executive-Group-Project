-- Grant schema-level and table-level access that was missing from the initial migration.
-- service_role bypasses RLS but still needs USAGE + table privileges in custom schemas.
-- authenticated role needs DML access; actual row access is controlled by existing RLS policies.

GRANT USAGE ON SCHEMA regulatory TO anon, authenticated, service_role;

GRANT ALL ON ALL TABLES    IN SCHEMA regulatory TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA regulatory TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES    IN SCHEMA regulatory TO authenticated;
GRANT USAGE, SELECT                  ON ALL SEQUENCES IN SCHEMA regulatory TO authenticated;

-- Apply the same defaults to any tables added in future migrations
ALTER DEFAULT PRIVILEGES IN SCHEMA regulatory
  GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA regulatory
  GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA regulatory
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA regulatory
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated;
