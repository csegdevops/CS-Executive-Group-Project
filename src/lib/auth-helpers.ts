import { cache } from "react"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import type { Role, Module, UserType } from "@/types/database"

export interface AuthUser {
  id: string
  email: string
  role: Role
  user_type: UserType
  full_name: string | null
}

interface AuthContext {
  role: Role
  userType: UserType
  fullName: string | null
  permissionKeys: string[]
  enabledModules: Module[]
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

/**
 * Role, full_name, permission keys, and enabled modules in one round trip
 * via get_own_auth_context() (self-scoped to auth.uid() in the function
 * body — see 20260731000003_speed_up_auth_context.sql), replacing what used
 * to be a profile query + two group/permission queries + a module_config
 * query. Cached per userId so every caller sharing a request (layout, page,
 * and — for the *ForUser helpers — an API route handler that already ran
 * its own auth.getUser()) collapses onto a single fetch. The passed userId
 * is only a cache key; the RPC itself always resolves the caller's own
 * session, so a caller can never read another user's grants through it.
 */
const fetchAuthContext = cache(async (_userId: string): Promise<AuthContext | null> => {
  const supabase = await createClient()
  const { data } = await supabase.rpc("get_own_auth_context").single()
  if (!data) return null
  return {
    role: data.role as Role,
    userType: (data.user_type ?? "internal") as UserType,
    fullName: data.full_name,
    permissionKeys: data.permission_keys ?? [],
    enabledModules: (data.enabled_modules ?? []) as Module[],
  }
})

/** Layout and page both call this (directly or via requireAuth/requireModuleAccess/etc.)
 * on every protected route. cache() collapses those into a single getUser() +
 * auth-context round trip per request instead of one per caller. */
export const getAuthUser = cache(async (): Promise<AuthUser | null> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const ctx = await fetchAuthContext(user.id)
  if (!ctx) return null

  return {
    id: user.id,
    email: user.email ?? "",
    role: ctx.role,
    user_type: ctx.userType,
    full_name: ctx.fullName,
  }
})

export async function requireAuth(): Promise<AuthUser> {
  const user = await getAuthUser()
  if (!user) redirect("/login")
  return user
}

export async function requireSuperAdmin(): Promise<AuthUser> {
  const user = await requireAuth()
  if (user.role !== "super_admin") redirect("/home")
  return user
}

export function hasPermission(keys: string[], key: string): boolean {
  return keys.includes(key)
}

export function hasModuleAccess(keys: string[], module: Module): boolean {
  return keys.some((k) => k.startsWith(`${module}.`))
}

/** "Module admin" is emergent: any permission beyond the bare `<module>.access` view-only key. */
export function isModuleAdmin(keys: string[], module: Module): boolean {
  return keys.some((k) => k.startsWith(`${module}.`) && k !== `${module}.access`)
}

export async function getUserPermissionKeys(userId: string): Promise<string[]> {
  const ctx = await fetchAuthContext(userId)
  return ctx?.permissionKeys ?? []
}

/** Same as getUserPermissionKeys — kept for call-site compatibility; the client param is unused. */
export async function getUserPermissionKeysWithClient(
  _supabase: SupabaseServerClient,
  userId: string
): Promise<string[]> {
  return getUserPermissionKeys(userId)
}

export async function hasPermissionForUser(
  _supabase: SupabaseServerClient,
  userId: string,
  key: string
): Promise<boolean> {
  const keys = await getUserPermissionKeys(userId)
  return hasPermission(keys, key)
}

/** For API routes: true if the user is super_admin or holds the given permission key. */
export async function requirePermissionOrSuperAdmin(
  _supabase: SupabaseServerClient,
  userId: string,
  key: string
): Promise<boolean> {
  const ctx = await fetchAuthContext(userId)
  if (!ctx) return false
  if (ctx.role === "super_admin") return true
  return hasPermission(ctx.permissionKeys, key)
}

export async function isModuleAdminForUser(
  _supabase: SupabaseServerClient,
  userId: string,
  module: Module
): Promise<boolean> {
  const keys = await getUserPermissionKeys(userId)
  return isModuleAdmin(keys, module)
}

export async function hasModuleAccessForUser(
  _supabase: SupabaseServerClient,
  userId: string,
  module: Module
): Promise<boolean> {
  const ctx = await fetchAuthContext(userId)
  if (!ctx) return false
  if (ctx.role === "super_admin") return true
  return hasModuleAccess(ctx.permissionKeys, module)
}

export async function getUserModules(userId: string): Promise<Module[]> {
  const keys = await getUserPermissionKeys(userId)
  const modules: Module[] = ["regulatory", "recruitment", "timesheets"]
  return modules.filter((m) => hasModuleAccess(keys, m))
}

export async function requireModuleAccess(module: Module): Promise<AuthUser> {
  const user = await requireAuth()
  if (user.role === "super_admin") return user
  const keys = await getUserPermissionKeys(user.id)
  if (!hasModuleAccess(keys, module)) redirect("/home")
  return user
}

export async function requireModuleAdmin(module: Module): Promise<AuthUser> {
  const user = await requireAuth()
  if (user.role === "super_admin") return user
  const keys = await getUserPermissionKeys(user.id)
  if (!isModuleAdmin(keys, module)) redirect(`/${module}/dashboard`)
  return user
}

/** Redirects home unless the user (or super_admin) holds the given permission key. */
export async function requirePermission(key: string): Promise<AuthUser> {
  const user = await requireAuth()
  if (user.role === "super_admin") return user
  const keys = await getUserPermissionKeys(user.id)
  if (!hasPermission(keys, key)) redirect("/home")
  return user
}

/** @deprecated Use requireSuperAdmin() or requireModuleAdmin() instead */
export async function requireAdmin(): Promise<AuthUser> {
  return requireSuperAdmin()
}

/** Layout and page both call this on every protected route — cached per request. */
export const getEnabledModules = cache(async (): Promise<Module[]> => {
  const user = await getAuthUser()
  if (!user) return []
  const ctx = await fetchAuthContext(user.id)
  return ctx?.enabledModules ?? []
})

/** Redirects to /home if the module is disabled system-wide. No super_admin bypass.
 * Only ever called from routes nested under (portal)/layout.tsx, which has already
 * run requireAuth() — so getAuthUser() here is always resolved from cache, never null. */
export async function requireModuleEnabled(module: Module): Promise<void> {
  const enabled = await getEnabledModules()
  if (!enabled.includes(module)) redirect("/home")
}

/**
 * External-user guards for the timesheets-portal shell (src/app/timesheets-portal/*,
 * served on its own subdomain via src/proxy.ts). Deliberately outside the
 * Module/PERMISSION_CATALOG/hasModuleAccess system — contractors and supervisors
 * hold zero permission-catalog grants (see grant_default_module_access() in
 * 20260806000001_timesheets_schema.sql) and never appear in Sidebar/PermissionsPicker.
 * redirect("/login") resolves relative to whichever host issued the request, so this
 * lands on the timesheets-portal's own login page, not the internal one.
 */
export async function requireContractorAuth(): Promise<AuthUser> {
  const user = await getAuthUser()
  if (!user || user.user_type !== "contractor") redirect("/login")
  return user
}

export async function requireSupervisorAuth(): Promise<AuthUser> {
  const user = await getAuthUser()
  if (!user || user.user_type !== "supervisor") redirect("/login")
  return user
}
