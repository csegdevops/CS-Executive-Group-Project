import { requireAuth, getUserPermissionKeys } from "@/lib/auth-helpers"
import { Sidebar } from "@/components/layout/Sidebar"

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireAuth()

  // null sentinel = super_admin, who implicitly holds every permission
  const permissionKeys = user.role === "super_admin" ? null : await getUserPermissionKeys(user.id)

  return (
    <div className="flex min-h-screen">
      <div className="print:hidden">
        <Sidebar
          role={user.role}
          userName={user.full_name}
          email={user.email}
          permissionKeys={permissionKeys}
        />
      </div>
      <main className="flex-1 overflow-auto print:overflow-visible">
        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}
