import { requireModuleAdmin } from "@/lib/auth-helpers"
import { createAdminClient } from "@/lib/supabase/admin"
import { PageHeader } from "@/components/layout/PageHeader"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/date-helpers"
import { CreateUserDialog } from "./CreateUserDialog"
import { UserActions } from "./UserActions"
import { ManageModulesDialog } from "./ManageModulesDialog"
import { AssignConsultationsDialog } from "./AssignConsultationsDialog"

export default async function UsersPage() {
  const currentUser = await requireModuleAdmin("regulatory")
  const admin = createAdminClient()

  // Fetch auth users (includes email) + profiles + module access in parallel
  const [authRes, profilesRes, accessRes] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from("profiles").select("id, full_name, role, is_active, created_at").order("full_name"),
    admin.from("user_module_access").select("user_id, module, access_level"),
  ])

  const emailMap = new Map(
    (authRes.data?.users ?? []).map((u) => [u.id, u.email ?? ""])
  )

  const moduleAccessByUser = new Map<string, { module: string; access_level: string }[]>()
  for (const row of accessRes.data ?? []) {
    const list = moduleAccessByUser.get(row.user_id) ?? []
    list.push({ module: row.module, access_level: row.access_level })
    moduleAccessByUser.set(row.user_id, list)
  }

  const allUsers = profilesRes.data ?? []
  const isSuperAdmin = currentUser.role === "super_admin"
  const users = isSuperAdmin ? allUsers : allUsers.filter((u) => u.role !== "super_admin")

  return (
    <div>
      <PageHeader title="User Management" description="Manage users, module access, and consultation assignments">
        {isSuperAdmin && <CreateUserDialog />}
      </PageHeader>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Name</th>
              <th className="text-left px-4 py-3 font-medium">Email</th>
              <th className="text-left px-4 py-3 font-medium">Role</th>
              <th className="text-left px-4 py-3 font-medium">Modules</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Joined</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map((u) => {
              const moduleAccess = u.role === "super_admin"
                ? []
                : (moduleAccessByUser.get(u.id) ?? [])
              const email = emailMap.get(u.id) ?? "—"

              return (
                <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{u.full_name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{email}</td>
                  <td className="px-4 py-3">
                    <Badge variant={u.role === "super_admin" ? "default" : "outline"} className="text-xs">
                      {u.role === "super_admin" ? "Super Admin" : "User"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {u.role === "super_admin" ? (
                      <Badge variant="secondary" className="text-xs">Full Access</Badge>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {moduleAccess.length === 0 ? (
                          <span className="text-xs text-muted-foreground">No access</span>
                        ) : (
                          moduleAccess.map((a) => (
                            <Badge
                              key={a.module}
                              variant={a.access_level === "admin" ? "default" : "outline"}
                              className="text-xs capitalize"
                            >
                              {a.module.slice(0, 3).toUpperCase()}{a.access_level === "admin" ? " ★" : ""}
                            </Badge>
                          ))
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {u.is_active ? (
                      <Badge variant="outline" className="text-xs text-green-700 border-green-300 bg-green-50">Active</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-gray-500">Inactive</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(u.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2 flex-wrap">
                      <AssignConsultationsDialog userId={u.id} userName={u.full_name} />
                      <ManageModulesDialog
                        userId={u.id}
                        isSuperAdmin={u.role === "super_admin"}
                        initialAccess={moduleAccess}
                        allowedModules={isSuperAdmin ? ["regulatory", "recruitment", "crm"] : ["regulatory"]}
                      />
                      {isSuperAdmin && (
                        <UserActions userId={u.id} isActive={u.is_active} currentUserId={currentUser.id} />
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {users.length === 0 && (
          <div className="text-center py-10 text-muted-foreground text-sm">No users found.</div>
        )}
      </div>
    </div>
  )
}
