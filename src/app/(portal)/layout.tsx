import { requireAuth, getUserPermissionKeys, getUserModules, getEnabledModules } from "@/lib/auth-helpers"
import { Sidebar } from "@/components/layout/Sidebar"
import { WrongPortalScreen } from "@/components/layout/WrongPortalScreen"
import type { Module } from "@/types/database"

const allModules: Module[] = ["regulatory", "recruitment", "timesheets"]

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireAuth()
  if (user.user_type !== "internal") return <WrongPortalScreen />
  const isSuperAdmin = user.role === "super_admin"

  const [permissionKeys, grantedModules, enabledModules] = await Promise.all([
    // null sentinel = super_admin, who implicitly holds every permission
    isSuperAdmin ? Promise.resolve(null) : getUserPermissionKeys(user.id),
    isSuperAdmin ? Promise.resolve(allModules) : getUserModules(user.id),
    getEnabledModules(),
  ])

  const enabledSet = new Set(enabledModules)
  const accessibleModules = allModules.filter((m) => enabledSet.has(m) && grantedModules.includes(m))

  return (
    <div className="flex min-h-screen">
      <div className="print:hidden">
        <Sidebar
          role={user.role}
          userName={user.full_name}
          email={user.email}
          permissionKeys={permissionKeys}
          accessibleModules={accessibleModules}
        />
      </div>
      <main className="flex-1 overflow-auto print:overflow-visible">
        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}
