import { requireSuperAdmin } from "@/lib/auth-helpers"
import { createAdminClient } from "@/lib/supabase/admin"
import { PageHeader } from "@/components/layout/PageHeader"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/date-helpers"
import { CreateUserDialog } from "./CreateUserDialog"
import { UserActions } from "./UserActions"
import { GroupBadges } from "./GroupBadges"
import { EditUserDialog } from "./EditUserDialog"
import { ManageUserGroupsDialog } from "./ManageUserGroupsDialog"

export default async function PlatformUsersPage() {
  const currentUser = await requireSuperAdmin()
  const admin = createAdminClient()

  const [authRes, profilesRes, groupsRes, membershipsRes] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from("profiles").select("id, full_name, role, is_active, created_at").order("full_name"),
    admin.from("user_groups").select("id, name, is_locked").order("name"),
    admin.from("user_group_members").select("user_id, group_id"),
  ])

  const emailMap = new Map(
    (authRes.data?.users ?? []).map((u) => [u.id, u.email ?? ""])
  )

  const allGroups = groupsRes.data ?? []
  const groupsById = new Map(allGroups.map((g) => [g.id, g]))

  const groupsByUser = new Map<string, { id: string; name: string; is_locked: boolean }[]>()
  for (const row of membershipsRes.data ?? []) {
    const group = groupsById.get(row.group_id)
    if (!group) continue
    const list = groupsByUser.get(row.user_id) ?? []
    list.push(group)
    groupsByUser.set(row.user_id, list)
  }

  const users = profilesRes.data ?? []

  return (
    <div>
      <PageHeader title="User Management" description="Manage all platform users and group access">
        <CreateUserDialog />
      </PageHeader>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Name</th>
              <th className="text-left px-4 py-3 font-medium">Email</th>
              <th className="text-left px-4 py-3 font-medium">Role</th>
              <th className="text-left px-4 py-3 font-medium">Groups</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Joined</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map((u) => {
              const userGroups = u.role === "super_admin" ? [] : (groupsByUser.get(u.id) ?? [])
              const email = emailMap.get(u.id) ?? "—"
              const isSuperAdmin = u.role === "super_admin"

              return (
                <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{u.full_name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{email}</td>
                  <td className="px-4 py-3">
                    <Badge variant={isSuperAdmin ? "default" : "outline"} className="text-xs">
                      {isSuperAdmin ? "Super Admin" : "User"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <GroupBadges groups={userGroups} isSuperAdmin={isSuperAdmin} />
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
                      <EditUserDialog
                        userId={u.id}
                        email={email}
                        initialFullName={u.full_name ?? ""}
                        initialRole={u.role}
                        isSelf={u.id === currentUser.id}
                      />
                      <ManageUserGroupsDialog
                        userId={u.id}
                        isSuperAdmin={isSuperAdmin}
                        allGroups={allGroups}
                        initialGroupIds={userGroups.map((g) => g.id)}
                      />
                      <UserActions userId={u.id} isActive={u.is_active} currentUserId={currentUser.id} />
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
