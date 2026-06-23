import { createClient } from "@/lib/supabase/server"
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

export async function getUserModules(userId: string): Promise<Module[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("user_module_access")
    .select("module")
    .eq("user_id", userId)
  return (data ?? []).map((r) => r.module as Module)
}

export async function requireModuleAccess(module: Module): Promise<AuthUser> {
  const user = await requireAuth()
  if (user.role === "super_admin") return user
  const modules = await getUserModules(user.id)
  if (!modules.includes(module)) redirect("/home")
  return user
}

export async function requireModuleAdmin(module: Module): Promise<AuthUser> {
  const user = await requireAuth()
  if (user.role === "super_admin") return user
  const supabase = await createClient()
  const { data } = await supabase
    .from("user_module_access")
    .select("access_level")
    .eq("user_id", user.id)
    .eq("module", module)
    .single()
  if (data?.access_level !== "admin") redirect(`/${module}/dashboard`)
  return user
}

/** @deprecated Use requireSuperAdmin() or requireModuleAdmin() instead */
export async function requireAdmin(): Promise<AuthUser> {
  return requireSuperAdmin()
}
