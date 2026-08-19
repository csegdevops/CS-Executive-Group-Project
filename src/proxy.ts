import { createServerClient } from "@supabase/ssr"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse, type NextRequest } from "next/server"

// Serves the external contractor/supervisor experience
// (src/app/timesheets-portal/*) on its own subdomain — kept out of the
// internal (portal) shell entirely (no Sidebar, no module switcher, no admin
// chrome). Requests on the main host are unaffected. Set TIMESHEETS_PORTAL_HOST
// (e.g. "timesheets.csexecgroup.com") once that domain is aliased to this
// same Vercel project; unset, this proxy behaves exactly as before.
const TIMESHEETS_PORTAL_HOST = process.env.TIMESHEETS_PORTAL_HOST

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // user_group_members/user_group_permissions are granted to service_role
  // only (see 20260721000001_user_groups.sql) — the request's own
  // anon/authenticated-key client has no privileges on them, so this must
  // go through the admin (service-role) client instead.
  async function getModuleAccessLevel(userId: string, module: string): Promise<string | null> {
    const admin = createAdminClient()
    const { data: memberships } = await admin
      .from("user_group_members")
      .select("group_id")
      .eq("user_id", userId)
    const groupIds = (memberships ?? []).map((m) => m.group_id)
    if (groupIds.length === 0) return null

    const { data: grants } = await admin
      .from("user_group_permissions")
      .select("permission_key")
      .in("group_id", groupIds)
      .like("permission_key", `${module}.%`)

    if (!grants || grants.length === 0) return null
    return grants.some((g) => g.permission_key !== `${module}.access`) ? "admin" : "member"
  }

  const { pathname: rawPathname } = request.nextUrl

  // API routes handle their own auth — never redirect them. Timesheets-portal
  // API routes live at the literal /api/timesheets-portal/* path (no rewrite
  // needed — client-side fetches from a timesheets-portal-host page already
  // resolve there directly), so this check is unaffected by the host below.
  if (rawPathname.startsWith("/api/")) return supabaseResponse

  // On the timesheets-portal host, every page guard below runs against the
  // *rewritten* path (as if the request already arrived at
  // /timesheets-portal/...) even though the actual rewrite only happens at
  // the very end — this keeps publicPaths/redirect targets correct without
  // duplicating the routing logic.
  const hostname = (request.headers.get("host") ?? "").split(":")[0]
  const isTimesheetsPortalHost = Boolean(TIMESHEETS_PORTAL_HOST) && hostname === TIMESHEETS_PORTAL_HOST
  const pathname = isTimesheetsPortalHost ? `/timesheets-portal${rawPathname}` : rawPathname

  // getUser() may have refreshed the auth cookies onto supabaseResponse (via
  // the setAll callback above). NextResponse.redirect()/rewrite() create a
  // brand new response, so any redirect/rewrite must carry those cookies
  // over — otherwise the browser keeps the stale/rotated-out refresh token
  // and every subsequent request bounces back to /login (infinite redirect
  // loop).
  function redirectTo(path: string) {
    const url = request.nextUrl.clone()
    url.pathname = path
    const response = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie)
    })
    return response
  }

  function rewriteToTimesheetsPortal() {
    const url = request.nextUrl.clone()
    url.pathname = pathname
    const response = NextResponse.rewrite(url)
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie)
    })
    return response
  }

  // Sends to the real timesheets subdomain (once configured) instead of a
  // path on this host — used both to keep the external UI off the main host
  // and to bounce contractor/supervisor accounts to their own portal.
  function redirectToTimesheetsHost(targetPath: string) {
    const url = new URL(targetPath || "/", `https://${TIMESHEETS_PORTAL_HOST}`)
    const response = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie)
    })
    return response
  }

  // Once the dedicated subdomain is live, the external contractor/supervisor
  // UI must never double-serve on the main host — same backend, wrong door.
  // Unset, this falls through and /timesheets-portal/* keeps working directly
  // on this host (the pre-DNS fallback already relied on elsewhere).
  if (TIMESHEETS_PORTAL_HOST && !isTimesheetsPortalHost && pathname.startsWith("/timesheets-portal")) {
    return redirectToTimesheetsHost(pathname.replace(/^\/timesheets-portal/, ""))
  }

  // Redirect unauthenticated users to login
  const publicPaths = [
    "/login", "/register", "/auth", "/forgot-password", "/reset-password",
    "/timesheets-portal/login", "/timesheets-portal/forgot-password", "/timesheets-portal/reset-password",
  ]
  if (!user && !publicPaths.some((p) => pathname.startsWith(p))) {
    return redirectTo("/login")
  }

  // Fetch profile once for all per-user checks below. Skipped on the
  // timesheets-portal host — nothing there is gated by role/user_type.
  let profile: { role: string | null; user_type: string | null } | null = null
  if (user && !isTimesheetsPortalHost) {
    const { data } = await supabase.from("profiles").select("role, user_type").eq("id", user.id).single()
    profile = data
  }
  const isSuperAdmin = profile?.role === "super_admin"
  const isExternalUser = profile?.user_type === "contractor" || profile?.user_type === "supervisor"

  // Contractors/supervisors are timesheets-portal-only accounts — confine
  // them to /timesheets-portal everywhere on this host, including pages with
  // no other guard (e.g. /home, which otherwise leaks internal module names).
  // This runs before the login/register redirect below so an authenticated
  // external user hitting /login doesn't fall through to /home.
  if (user && isExternalUser && !isTimesheetsPortalHost && !pathname.startsWith("/timesheets-portal")) {
    return TIMESHEETS_PORTAL_HOST ? redirectToTimesheetsHost("/") : redirectTo("/timesheets-portal")
  }

  // Redirect authenticated users away from login/register. On the
  // timesheets-portal host this targets "/" (bare root, so it re-enters the
  // rewrite below) rather than "/home" — contractors/supervisors have no
  // access to the internal portal's /home at all.
  if (user && isTimesheetsPortalHost && pathname === "/timesheets-portal/login") {
    return redirectTo("/")
  }
  if (user && !isTimesheetsPortalHost && (pathname === "/login" || pathname === "/register")) {
    return redirectTo("/home")
  }

  if (user && !isTimesheetsPortalHost && !isExternalUser) {
    // /regulatory/admin/* — requires module admin or super admin
    if (pathname.startsWith("/regulatory/admin") && !isSuperAdmin) {
      const accessLevel = await getModuleAccessLevel(user.id, "regulatory")

      if (accessLevel !== "admin") {
        return redirectTo("/regulatory/dashboard")
      }
    }

    // Module route guards — super admins bypass all
    if (!isSuperAdmin) {
      const moduleMap: Record<string, string> = {
        "/regulatory": "regulatory",
        "/recruitment": "recruitment",
        "/timesheets": "timesheets",
        "/ims": "ims",
      }

      const activeModule = Object.keys(moduleMap).find((p) => pathname.startsWith(p))

      if (activeModule) {
        const accessLevel = await getModuleAccessLevel(user.id, moduleMap[activeModule])

        if (!accessLevel) {
          return redirectTo("/home")
        }
      }
    }
  }

  return isTimesheetsPortalHost ? rewriteToTimesheetsPortal() : supabaseResponse
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
