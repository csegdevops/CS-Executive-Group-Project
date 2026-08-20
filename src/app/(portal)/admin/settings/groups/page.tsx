import { requireSuperAdmin } from "@/lib/auth-helpers"
import { createAdminClient } from "@/lib/supabase/admin"
import { PageHeader } from "@/components/layout/PageHeader"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { formatDate } from "@/lib/date-helpers"
import { BackButton } from "./BackButton"
import { CreateUserGroupDialog } from "./CreateUserGroupDialog"
import { GroupCard } from "./GroupCard"
import { CreateUserDialog } from "../../users/CreateUserDialog"
import { UserActions } from "../../users/UserActions"
import { GroupBadges } from "../../users/GroupBadges"
import { EditUserDialog } from "../../users/EditUserDialog"
import { ManageUserGroupsDialog } from "../../users/ManageUserGroupsDialog"

export interface UserGroupWithGrants {
  id: string
  name: string
  description: string | null
  is_locked: boolean
  permissionKeys: string[]
  memberCount: number
}

export default async function SecurityGroupsPage() {
  const currentUser = await requireSuperAdmin()
  const admin = createAdminClient()

  const [groupsRes, permsRes, membersRes, authRes, profilesRes] = await Promise.all([
    admin.from("user_groups").select("id, name, description, is_locked").order("name"),
    admin.from("user_group_permissions").select("group_id, permission_key"),
    admin.from("user_group_members").select("group_id, user_id"),
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from("profiles").select("id, full_name, role, is_active, created_at").order("full_name"),
  ])

  const permsByGroup = new Map<string, string[]>()
  for (const row of permsRes.data ?? []) {
    const list = permsByGroup.get(row.group_id) ?? []
    list.push(row.permission_key)
    permsByGroup.set(row.group_id, list)
  }

  const memberCountByGroup = new Map<string, number>()
  for (const row of membersRes.data ?? []) {
    memberCountByGroup.set(row.group_id, (memberCountByGroup.get(row.group_id) ?? 0) + 1)
  }

  const groups: UserGroupWithGrants[] = (groupsRes.data ?? []).map((g) => ({
    ...g,
    permissionKeys: permsByGroup.get(g.id) ?? [],
    memberCount: memberCountByGroup.get(g.id) ?? 0,
  }))

  const emailMap = new Map((authRes.data?.users ?? []).map((u) => [u.id, u.email ?? ""]))
  const allGroups = groups.map((g) => ({ id: g.id, name: g.name, is_locked: g.is_locked }))
  const groupsById = new Map(allGroups.map((g) => [g.id, g]))

  const groupsByUser = new Map<string, { id: string; name: string; is_locked: boolean }[]>()
  for (const row of membersRes.data ?? []) {
    const group = groupsById.get(row.group_id)
    if (!group) continue
    const list = groupsByUser.get(row.user_id) ?? []
    list.push(group)
    groupsByUser.set(row.user_id, list)
  }

  const users = profilesRes.data ?? []

  return (
    <div className="max-w-4xl space-y-6">
      <BackButton />
      <PageHeader title="Security Groups" description="Manage permission groups and the platform users assigned to them." />

      <Tabs defaultValue="groups">
        <TabsList>
          <TabsTrigger value="groups">Groups</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
        </TabsList>

        <TabsContent value="groups" className="space-y-3 mt-4">
          <div className="flex justify-end">
            <CreateUserGroupDialog />
          </div>
          {groups.map((group) => (
            <GroupCard key={group.id} group={group} />
          ))}
          {groups.length === 0 && (
            <p className="text-center py-10 text-muted-foreground text-sm">No groups yet.</p>
          )}
        </TabsContent>

        <TabsContent value="users" className="mt-4">
          <div className="flex justify-end mb-3">
            <CreateUserDialog allGroups={allGroups} />
          </div>
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
        </TabsContent>
      </Tabs>
    </div>
  )
}
