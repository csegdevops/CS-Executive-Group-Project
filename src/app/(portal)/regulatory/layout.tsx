import { requireModuleEnabled, requireModuleAccess } from "@/lib/auth-helpers"

export default async function RegulatoryLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireModuleEnabled("regulatory")
  await requireModuleAccess("regulatory")
  return <>{children}</>
}
