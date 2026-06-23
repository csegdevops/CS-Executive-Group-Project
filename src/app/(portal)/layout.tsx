import { requireAuth } from "@/lib/auth-helpers"
import { createClient } from "@/lib/supabase/server"
import { Sidebar } from "@/components/layout/Sidebar"
import type { Module } from "@/types/database"

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireAuth()
  const supabase = await createClient()

  // Determine which modules this user has admin access to
  let moduleAdminOf: Module[] = []
  if (user.role === "super_admin") {
    moduleAdminOf = ["regulatory", "recruitment", "crm"]
  } else {
    const { data } = await supabase
      .from("user_module_access")
      .select("module")
      .eq("user_id", user.id)
      .eq("access_level", "admin")
    moduleAdminOf = (data ?? []).map((r) => r.module as Module)
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar role={user.role} userName={user.full_name} moduleAdminOf={moduleAdminOf} />
      <main className="flex-1 overflow-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}
