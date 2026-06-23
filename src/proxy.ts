import { createServerClient } from "@supabase/ssr"
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

  const { pathname } = request.nextUrl

  // API routes handle their own auth — never redirect them
  if (pathname.startsWith("/api/")) return supabaseResponse

  // Redirect unauthenticated users to login
  const publicPaths = ["/login", "/register", "/auth"]
  if (!user && !publicPaths.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users away from login/register
  if (user && (pathname === "/login" || pathname === "/register")) {
    const url = request.nextUrl.clone()
    url.pathname = "/home"
    return NextResponse.redirect(url)
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
      const { data: access } = await supabase
        .from("user_module_access")
        .select("access_level")
        .eq("user_id", user.id)
        .eq("module", "regulatory")
        .single()

      if (access?.access_level !== "admin") {
        const url = request.nextUrl.clone()
        url.pathname = "/regulatory/dashboard"
        return NextResponse.redirect(url)
      }
    }

    // Module route guards — super admins bypass all
    if (!isSuperAdmin) {
      const moduleMap: Record<string, string> = {
        "/regulatory": "regulatory",
        "/recruitment": "recruitment",
        "/crm": "crm",
      }

      const activeModule = Object.keys(moduleMap).find((p) => pathname.startsWith(p))

      if (activeModule) {
        const { data: access } = await supabase
          .from("user_module_access")
          .select("access_level")
          .eq("user_id", user.id)
          .eq("module", moduleMap[activeModule])
          .single()

        if (!access) {
          const url = request.nextUrl.clone()
          url.pathname = "/home"
          return NextResponse.redirect(url)
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
