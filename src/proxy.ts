import { createServerClient } from "@supabase/ssr"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse, type NextRequest } from "next/server"

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

  const { pathname } = request.nextUrl

  // API routes handle their own auth — never redirect them
  if (pathname.startsWith("/api/")) return supabaseResponse

  // getUser() may have refreshed the auth cookies onto supabaseResponse (via
  // the setAll callback above). NextResponse.redirect() creates a brand new
  // response, so any redirect must carry those cookies over — otherwise the
  // browser keeps the stale/rotated-out refresh token and every subsequent
  // request bounces back to /login (infinite redirect loop).
  function redirectTo(path: string) {
    const url = request.nextUrl.clone()
    url.pathname = path
    const response = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie)
    })
    return response
  }

  // Redirect unauthenticated users to login
  const publicPaths = ["/login", "/register", "/auth", "/forgot-password", "/reset-password"]
  if (!user && !publicPaths.some((p) => pathname.startsWith(p))) {
    return redirectTo("/login")
  }

  // Redirect authenticated users away from login/register
  if (user && (pathname === "/login" || pathname === "/register")) {
    return redirectTo("/home")
  }

  if (user) {
    // Fetch profile once for all per-user checks
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    const isSuperAdmin = profile?.role === "super_admin"

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

  return supabaseResponse
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
