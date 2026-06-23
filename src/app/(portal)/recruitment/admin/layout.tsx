import { requireModuleAdmin } from "@/lib/auth-helpers"

export default async function RecruitmentAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireModuleAdmin("recruitment")
  return <>{children}</>
}
