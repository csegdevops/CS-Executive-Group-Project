import { requireModuleAccess } from "@/lib/auth-helpers"

export default async function RegulatoryLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireModuleAccess("regulatory")
  return <>{children}</>
}
