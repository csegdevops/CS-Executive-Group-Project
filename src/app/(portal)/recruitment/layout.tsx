import { requireModuleAccess } from "@/lib/auth-helpers"

export default async function RecruitmentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireModuleAccess("recruitment")
  return <>{children}</>
}
