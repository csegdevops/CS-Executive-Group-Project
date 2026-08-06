import { redirect } from "next/navigation"
import { getAuthUser } from "@/lib/auth-helpers"
import { TimesheetsPortalHeader } from "./TimesheetsPortalHeader"

// Minimal shell for the authenticated contractor/supervisor experience — no
// Sidebar, no module switcher, no admin chrome. Individual pages
// (my-timesheets, approvals) additionally call requireContractorAuth()/
// requireSupervisorAuth() for the stricter per-type check; this layout only
// guards against unauthenticated or internal-staff access.
export default async function TimesheetsPortalAppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getAuthUser()
  if (!user || user.user_type === "internal") redirect("/login")

  return (
    <div className="min-h-screen flex flex-col">
      <TimesheetsPortalHeader userName={user.full_name} />
      <main className="flex-1 p-6 max-w-3xl w-full mx-auto">{children}</main>
    </div>
  )
}
