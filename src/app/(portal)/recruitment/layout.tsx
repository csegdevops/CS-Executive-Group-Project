import { requireModuleEnabled, requireModuleAccess } from "@/lib/auth-helpers"

export default async function RecruitmentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireModuleEnabled("recruitment")
  await requireModuleAccess("recruitment")
  return <>{children}</>
}
