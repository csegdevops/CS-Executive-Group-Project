import { requireModuleAdmin } from "@/lib/auth-helpers"

export default async function RegulatoryAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireModuleAdmin("regulatory")
  return <>{children}</>
}
