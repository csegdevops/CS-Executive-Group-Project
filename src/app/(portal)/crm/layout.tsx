import { requireModuleAccess } from "@/lib/auth-helpers"

export default async function CrmLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireModuleAccess("crm")
  return <>{children}</>
}
