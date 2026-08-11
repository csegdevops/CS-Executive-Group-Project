-- ─────────────────────────────────────────────────────────────────────────────
-- Re-restrict recruitment.upsert_candidate to service_role only.
--
-- 20260723000007_revoke_public_execute.sql already locked this function down
-- once (every real call site — /api/applications, /api/public/apply, the
-- Seek webhook — uses the admin/service_role client exclusively). That grant
-- was lost in this session: 20260811000002 dropped the old-signature
-- overloads and CREATE FUNCTION on the new signature (20260811000001) is, to
-- Postgres, a brand-new function object with no inherited ACL — it fell back
-- to Postgres's built-in default of EXECUTE granted to PUBLIC, re-opening
-- the advisory (`anon_security_definer_function_executable` /
-- `authenticated_security_definer_function_executable`).
--
-- Also sets a default privilege on the recruitment schema so this doesn't
-- recur the next time a function here needs replacing: PUBLIC no longer gets
-- an automatic EXECUTE grant on newly created functions (matching how the
-- table/sequence default ACLs on this schema already exclude anon). Every
-- future function still needs its own explicit GRANT, same as today.
-- Migration: 20260811000003_restrict_upsert_candidate_grants.sql
-- ─────────────────────────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION recruitment.upsert_candidate(
  text, text, text, text, text, text, text, text, text, text, jsonb, text[],
  text, text, uuid, text, numeric, text, boolean, jsonb
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION recruitment.upsert_candidate(
  text, text, text, text, text, text, text, text, text, text, jsonb, text[],
  text, text, uuid, text, numeric, text, boolean, jsonb
) TO service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA recruitment
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
