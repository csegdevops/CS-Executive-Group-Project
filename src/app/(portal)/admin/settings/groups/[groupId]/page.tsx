import Link from "next/link"
import { notFound } from "next/navigation"
import { requireSuperAdmin } from "@/lib/auth-helpers"
import { createAdminClient } from "@/lib/supabase/admin"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronLeft } from "lucide-react"
import { GroupDetailHeader } from "./GroupDetailHeader"
import { GroupPermissionsEditor } from "./GroupPermissionsEditor"
import { GroupMembersSection } from "./GroupMembersSection"

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ groupId: string }>
}) {
  await requireSuperAdmin()
  const { groupId } = await params
  const admin = createAdminClient()

  const [groupRes, permsRes, membersRes, profilesRes, authRes] = await Promise.all([
    admin.from("user_groups").select("id, name, description, is_locked").eq("id", groupId).single(),
    admin.from("user_group_permissions").select("permission_key").eq("group_id", groupId),
    admin.from("user_group_members").select("user_id").eq("group_id", groupId),
    admin.from("profiles").select("id, full_name, role").order("full_name"),
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ])

  if (!groupRes.data) notFound()
  const group = groupRes.data

  const emailMap = new Map((authRes.data?.users ?? []).map((u) => [u.id, u.email ?? ""]))
  const memberIds = new Set((membersRes.data ?? []).map((m) => m.user_id))
  const profiles = profilesRes.data ?? []
  const profileById = new Map(profiles.map((p) => [p.id, p]))

  const members = [...memberIds]
    .map((id) => profileById.get(id))
    .filter((p): p is NonNullable<typeof p> => !!p)
    .map((p) => ({ id: p.id, name: p.full_name ?? "—", email: emailMap.get(p.id) ?? "—" }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const candidates = profiles
    .filter((p) => p.role !== "super_admin" && !memberIds.has(p.id))
    .map((p) => ({ id: p.id, name: p.full_name ?? "—", email: emailMap.get(p.id) ?? "—" }))

  const permissionKeys = (permsRes.data ?? []).map((r) => r.permission_key)

  return (
    <div className="max-w-3xl space-y-6">
      <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground hover:text-foreground" asChild>
        <Link href="/admin/settings/groups">
          <ChevronLeft className="h-4 w-4 mr-1" />
          Security Groups
        </Link>
      </Button>

      <GroupDetailHeader
        groupId={group.id}
        name={group.name}
        description={group.description}
        memberCount={members.length}
        permissionCount={permissionKeys.length}
        locked={group.is_locked}
      />

      <Card>
        <CardContent className="py-5">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Permissions</h2>
          <GroupPermissionsEditor groupId={group.id} initialKeys={permissionKeys} locked={group.is_locked} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-5">
          <GroupMembersSection
            groupId={group.id}
            members={members}
            candidates={candidates}
            locked={group.is_locked}
          />
        </CardContent>
      </Card>
    </div>
  )
}
