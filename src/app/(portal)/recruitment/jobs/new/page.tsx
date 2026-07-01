import { requireModuleAccess } from "@/lib/auth-helpers"
import { createAdminClient } from "@/lib/supabase/admin"
import { PageHeader } from "@/components/layout/PageHeader"
import { NewJobForm } from "./NewJobForm"

export default async function NewJobPage() {
  const user = await requireModuleAccess("recruitment")
  const admin = createAdminClient()

  const [{ data: companies }, { data: profiles }] = await Promise.all([
    admin.from("companies").select("id, name").order("name"),
    admin.from("profiles").select("id, full_name").order("full_name"),
  ])

  return (
    <div className="max-w-2xl">
      <PageHeader title="New Job" description="Create a new job order" />
      <NewJobForm
        companies={(companies ?? []).map((c: { id: string; name: string }) => ({ id: c.id, name: c.name }))}
        recruiters={(profiles ?? []).map((p: { id: string; full_name: string | null }) => ({ id: p.id, name: p.full_name ?? "Unknown" }))}
        currentUserId={user.id}
      />
    </div>
  )
}
