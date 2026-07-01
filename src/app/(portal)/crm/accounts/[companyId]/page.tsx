import { requireAuth } from "@/lib/auth-helpers"
import { CompanyDetailContent } from "@/app/(portal)/companies/[companyId]/CompanyDetailContent"

export default async function CrmCompanyPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const user = await requireAuth()
  const { companyId } = await params
  const { tab = "overview" } = await searchParams

  return (
    <CompanyDetailContent
      companyId={companyId}
      tab={tab}
      backHref="/crm/accounts"
      backLabel="Accounts"
      basePath={`/crm/accounts/${companyId}`}
      user={user}
    />
  )
}
