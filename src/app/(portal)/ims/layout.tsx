import { requireModuleEnabled, requireModuleAccess } from "@/lib/auth-helpers"

export default async function ImsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireModuleEnabled("ims")
  await requireModuleAccess("ims")
  return <>{children}</>
}
