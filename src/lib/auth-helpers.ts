import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { redirect } from "next/navigation"
import type { Role, Module } from "@/types/database"

export interface AuthUser {
  id: string
  email: string
  role: Role
  full_name: string | null
}

export async function getAuthUser(): Promise<AuthUser | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single()

  if (!profile) return null

  return {
    id: user.id,
    email: user.email ?? "",
    role: profile.role as Role,
    full_name: profile.full_name,
  }
}

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

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

/**
 * All permission keys a user holds, resolved through their user_groups
 * membership. user_group_members/user_group_permissions are deliberately
 * granted to service_role only (see 20260721000001_user_groups.sql) — a
 * user's own session client has zero privileges on them, so this must
 * always read through the admin (service-role) client regardless of what
 * client the caller passed in. This function runs entirely server-side and
 * is never reachable from the browser, so that's safe.
 */
async function fetchUserPermissionKeys(
  _supabase: SupabaseServerClient,
  userId: string
): Promise<string[]> {
  const admin = createAdminClient()
  const { data: memberships } = await admin
    .from("user_group_members")
    .select("group_id")
    .eq("user_id", userId)
  const groupIds = (memberships ?? []).map((m) => m.group_id)
  if (groupIds.length === 0) return []

  const { data: grants } = await admin
    .from("user_group_permissions")
    .select("permission_key")
    .in("group_id", groupIds)
  return (grants ?? []).map((g) => g.permission_key)
}

export async function getUserPermissionKeys(userId: string): Promise<string[]> {
  const supabase = await createClient()
  return fetchUserPermissionKeys(supabase, userId)
}

/** Same as getUserPermissionKeys, but reuses an already-created client. */
export async function getUserPermissionKeysWithClient(
  supabase: SupabaseServerClient,
  userId: string
): Promise<string[]> {
  return fetchUserPermissionKeys(supabase, userId)
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

export async function hasPermissionForUser(
  supabase: SupabaseServerClient,
  userId: string,
  key: string
): Promise<boolean> {
  const keys = await fetchUserPermissionKeys(supabase, userId)
  return hasPermission(keys, key)
}

/** For API routes: true if the user is super_admin or holds the given permission key. */
export async function requirePermissionOrSuperAdmin(
  supabase: SupabaseServerClient,
  userId: string,
  key: string
): Promise<boolean> {
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).single()
  if (profile?.role === "super_admin") return true
  return hasPermissionForUser(supabase, userId, key)
}

export async function isModuleAdminForUser(
  supabase: SupabaseServerClient,
  userId: string,
  module: Module
): Promise<boolean> {
  const keys = await fetchUserPermissionKeys(supabase, userId)
  return isModuleAdmin(keys, module)
}

export async function hasModuleAccessForUser(
  supabase: SupabaseServerClient,
  userId: string,
  module: Module
): Promise<boolean> {
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).single()
  if (profile?.role === "super_admin") return true
  const keys = await fetchUserPermissionKeys(supabase, userId)
  return hasModuleAccess(keys, module)
}

export async function getUserModules(userId: string): Promise<Module[]> {
  const keys = await getUserPermissionKeys(userId)
  const modules: Module[] = ["regulatory", "recruitment", "crm"]
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

export async function getEnabledModules(): Promise<Module[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("module_config")
    .select("module")
    .eq("is_enabled", true)
  return (data ?? []).map((r) => r.module as Module)
}

/** Redirects to /home if the module is disabled system-wide. No super_admin bypass. */
export async function requireModuleEnabled(module: Module): Promise<void> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("module_config")
    .select("is_enabled")
    .eq("module", module)
    .single()
  if (!data?.is_enabled) redirect("/home")
}
