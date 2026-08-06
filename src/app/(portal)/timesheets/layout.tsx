import { requireModuleEnabled, requireModuleAccess } from "@/lib/auth-helpers"

export default async function TimesheetsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireModuleEnabled("timesheets")
  await requireModuleAccess("timesheets")
  return <>{children}</>
}
