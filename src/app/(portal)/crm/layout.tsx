import { requireModuleEnabled, requireModuleAccess } from "@/lib/auth-helpers"

export default async function CrmLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireModuleEnabled("crm")
  await requireModuleAccess("crm")
  return <>{children}</>
}
