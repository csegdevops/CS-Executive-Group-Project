import { requireSuperAdmin } from "@/lib/auth-helpers"

export default async function PlatformAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireSuperAdmin()
  return <>{children}</>
}
