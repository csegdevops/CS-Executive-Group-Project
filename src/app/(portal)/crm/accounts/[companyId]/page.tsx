import { redirect } from "next/navigation"

export default async function Page({
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
