-- Speeds up per-navigation auth checks (requireAuth/requireModuleAccess/etc.
-- run on every portal page load and every API route):
--
-- 1) user_group_members.user_id had no covering index (flagged by the
--    Supabase performance advisor). Every permission-key lookup filters on
--    exactly this column via `WHERE user_id = auth.uid()`.
--
-- 2) The app previously did up to 4 sequential round trips per request to
--    resolve a user's role/full_name (profiles), permission keys
--    (user_group_members join user_group_permissions), and enabled modules
--    (module_config). Collapsed into one RPC call.

create index if not exists idx_user_group_members_user_id
  on public.user_group_members(user_id);

create or replace function public.get_own_auth_context()
returns table (
  role text,
  full_name text,
  permission_keys text[],
  enabled_modules text[]
)
language sql
stable
security definer
set search_path to ''
as $function$
  select
    p.role,
    p.full_name,
    coalesce((
      select array_agg(distinct perm.permission_key)
      from public.user_group_members mem
      join public.user_group_permissions perm on perm.group_id = mem.group_id
      where mem.user_id = p.id
    ), '{}'::text[]) as permission_keys,
    coalesce((
      select array_agg(mc.module)
      from public.module_config mc
      where mc.is_enabled = true
    ), '{}'::text[]) as enabled_modules
  from public.profiles p
  where p.id = auth.uid();
$function$;

-- Self-scoped via auth.uid() inside the function body, so it's safe to grant
-- directly to authenticated users — nobody can read another user's grants
-- through it, regardless of what arguments a caller might try to pass.
revoke all on function public.get_own_auth_context() from public;
grant execute on function public.get_own_auth_context() to authenticated;
