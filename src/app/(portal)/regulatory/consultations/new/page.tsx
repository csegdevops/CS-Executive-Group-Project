import { requireModuleAccess } from "@/lib/auth-helpers"
import { createAdminClient } from "@/lib/supabase/admin"
import { NewConsultationWizard } from "./NewConsultationWizard"

export default async function NewConsultationPage({
  searchParams,
}: {
  searchParams: Promise<{ company_id?: string }>
}) {
  await requireModuleAccess("regulatory")
  const { company_id } = await searchParams

  const admin = createAdminClient()
  const { data: companies } = await admin
    .from("companies")
    .select("id, name, country")
    .eq("is_active", true)
    .order("name")

  return (
    <NewConsultationWizard
      companies={companies ?? []}
      initialCompanyId={company_id ?? null}
    />
  )
}
