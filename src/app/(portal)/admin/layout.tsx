import { requireAuth } from "@/lib/auth-helpers"

// Not a blanket super_admin gate — each page under here enforces its own
// access (some stay super_admin-only via their own requireSuperAdmin() call,
// e.g. settings/groups, settings/domains; settings/page.tsx is gated by the
// granular platform_settings.view permission instead). This layout just
// confirms the user is logged in.
export default async function PlatformAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireAuth()
  return <>{children}</>
}
