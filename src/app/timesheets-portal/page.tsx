import { redirect } from "next/navigation"
import { getAuthUser } from "@/lib/auth-helpers"

// Root dispatcher for the timesheets-portal subdomain — routes a signed-in
// user to their own view based on user_type, or to login if unauthenticated
// (or logged in as the wrong type, e.g. internal staff hitting this host).
export default async function TimesheetsPortalRootPage() {
  const user = await getAuthUser()
  if (!user) redirect("/login")
  if (user.user_type === "contractor") redirect("/my-timesheets")
  if (user.user_type === "supervisor") redirect("/approvals")
  redirect("/login")
}
