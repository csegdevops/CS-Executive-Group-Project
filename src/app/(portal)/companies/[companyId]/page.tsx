import { redirect } from "next/navigation"

// Redirect bare /companies/[id] links to the Recruitment-context URL so the sidebar stays intact.
// Module-specific entry points live at /regulatory/companies/[id], /recruitment/companies/[id], etc.
export default async function CompanyRedirectPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { companyId } = await params
  const { tab } = await searchParams
  redirect(`/recruitment/companies/${companyId}${tab ? `?tab=${tab}` : ""}`)
}
