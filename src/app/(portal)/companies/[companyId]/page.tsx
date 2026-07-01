import { redirect } from "next/navigation"

// Redirect bare /companies/[id] links to the CRM-context URL so the sidebar stays intact.
// Module-specific entry points live at /regulatory/companies/[id], /crm/accounts/[id], etc.
export default async function CompanyRedirectPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { companyId } = await params
  const { tab } = await searchParams
  redirect(`/crm/accounts/${companyId}${tab ? `?tab=${tab}` : ""}`)
}
