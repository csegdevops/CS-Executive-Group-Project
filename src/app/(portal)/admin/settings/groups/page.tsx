import { requireSuperAdmin } from "@/lib/auth-helpers"
import { createAdminClient } from "@/lib/supabase/admin"
import { PageHeader } from "@/components/layout/PageHeader"
import { BackButton } from "./BackButton"
import { CreateUserGroupDialog } from "./CreateUserGroupDialog"
import { GroupCard } from "./GroupCard"

export interface UserGroupWithGrants {
  id: string
  name: string
  description: string | null
  is_locked: boolean
  permissionKeys: string[]
  memberCount: number
}

export default async function UserGroupsPage() {
  await requireSuperAdmin()
  const admin = createAdminClient()

  const [groupsRes, permsRes, membersRes] = await Promise.all([
    admin.from("user_groups").select("id, name, description, is_locked").order("name"),
    admin.from("user_group_permissions").select("group_id, permission_key"),
    admin.from("user_group_members").select("group_id"),
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

  return (
    <div className="max-w-2xl space-y-6">
      <BackButton />
      <PageHeader title="User Groups" description="Groups grant permissions to their members.">
        <CreateUserGroupDialog />
      </PageHeader>

      <div className="space-y-3">
        {groups.map((group) => (
          <GroupCard key={group.id} group={group} />
        ))}
        {groups.length === 0 && (
          <p className="text-center py-10 text-muted-foreground text-sm">No groups yet.</p>
        )}
      </div>
    </div>
  )
}
