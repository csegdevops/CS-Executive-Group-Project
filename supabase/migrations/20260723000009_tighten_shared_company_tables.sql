-- ─────────────────────────────────────────────────────────────────────────────
-- contacts_authenticated / activities_authenticated / branches_authenticated
-- were USING (true) WITH CHECK (true) — any authenticated user, including one
-- with zero module memberships, could read/write/delete any company's
-- contacts, activity log, and branches. These tables are deliberately shared
-- across regulatory/recruitment/crm (companies are a cross-module hub), so
-- the fix is not to scope them to one module like has_company_access() does
-- for regulatory — that would break recruitment/CRM users who legitimately
-- work with these records today. Instead, require membership in *some*
-- module, closing the "not a member of anything" gap while preserving full
-- cross-module access for anyone who actually belongs to a module.
-- Migration: 20260723000009_tighten_shared_company_tables.sql
-- ─────────────────────────────────────────────────────────────────────────────

ALTER POLICY contacts_authenticated ON public.contacts
  USING (
    (select has_module_access('regulatory'))
    OR (select has_module_access('recruitment'))
    OR (select has_module_access('crm'))
  )
  WITH CHECK (
    (select has_module_access('regulatory'))
    OR (select has_module_access('recruitment'))
    OR (select has_module_access('crm'))
  );

ALTER POLICY activities_authenticated ON public.company_activities
  USING (
    (select has_module_access('regulatory'))
    OR (select has_module_access('recruitment'))
    OR (select has_module_access('crm'))
  )
  WITH CHECK (
    (select has_module_access('regulatory'))
    OR (select has_module_access('recruitment'))
    OR (select has_module_access('crm'))
  );

ALTER POLICY branches_authenticated ON public.company_branches
  USING (
    (select has_module_access('regulatory'))
    OR (select has_module_access('recruitment'))
    OR (select has_module_access('crm'))
  )
  WITH CHECK (
    (select has_module_access('regulatory'))
    OR (select has_module_access('recruitment'))
    OR (select has_module_access('crm'))
  );
