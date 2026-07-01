"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  FlaskConical,
  LayoutDashboard,
  FileText,
  Beaker,
  Building2,
  Users,
  Database,
  LogOut,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Globe,
  Settings,
  Sun,
  Moon,
  Monitor,
  Briefcase,
  UserSearch,
  ClipboardList,
  ListChecks,
  ChevronsLeft,
  ChevronsRight,
  TrendingUp,
  CalendarClock,
} from "lucide-react"
import type { Role, Module } from "@/types/database"

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  adminOnly?: boolean
  superAdminOnly?: boolean
}

const moduleNavItems: Record<string, NavItem[]> = {
  regulatory: [
    { label: "Dashboard",        href: "/regulatory/dashboard",                icon: LayoutDashboard },
    { label: "Consultations",    href: "/regulatory/consultations",            icon: FileText },
    { label: "Companies",        href: "/regulatory/companies",                icon: Building2 },
    { label: "Chemicals",        href: "/regulatory/chemicals",                icon: Beaker },
    { label: "Regulatory Lists", href: "/regulatory/admin/regulatory-lists",   icon: Database,       adminOnly: true },
    { label: "Users",            href: "/regulatory/admin/users",              icon: Users,          adminOnly: true },
    { label: "Reference Data",   href: "/regulatory/admin/lookup-values",      icon: ListChecks,     adminOnly: true },
  ],
  recruitment: [
    { label: "Dashboard",    href: "/recruitment/dashboard",           icon: LayoutDashboard },
    { label: "Jobs",         href: "/recruitment/jobs",                icon: Briefcase },
    { label: "Candidates",   href: "/recruitment/candidates",          icon: UserSearch },
    { label: "Applications", href: "/recruitment/applications",        icon: ClipboardList },
    { label: "Tasks",        href: "/recruitment/tasks",               icon: ListChecks },
    { label: "Users",        href: "/recruitment/admin/users",         icon: Users,          adminOnly: true },
    { label: "Reference Data",href: "/recruitment/admin/lookup-values",icon: ListChecks,     adminOnly: true },
  ],
  crm: [
    { label: "Dashboard",  href: "/crm/dashboard",   icon: LayoutDashboard },
    { label: "Client Companies", href: "/crm/accounts",    icon: Building2 },
    { label: "Pipeline",   href: "/crm/pipeline",    icon: TrendingUp },
    { label: "Activities", href: "/crm/activities",  icon: CalendarClock },
  ],
}

const moduleLabels: Record<string, string> = {
  regulatory: "Regulatory DB",
  recruitment: "Recruitment",
  crm: "CRM",
}

const moduleIcons: Record<string, React.ElementType> = {
  regulatory: FlaskConical,
  recruitment: Users,
  crm: Building2,
}

interface SidebarProps {
  role: Role
  userName: string | null
  moduleAdminOf: Module[]
}

function NavLink({ item, collapsed, pathname }: { item: NavItem; collapsed: boolean; pathname: string }) {
  const Icon = item.icon
  const isActive = item.href.endsWith("/dashboard")
    ? pathname === item.href
    : pathname.startsWith(item.href)

  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      className={cn(
        "flex items-center rounded-md text-sm font-medium transition-colors",
        collapsed
          ? "justify-center p-2"
          : "gap-3 px-3 py-2",
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && item.label}
    </Link>
  )
}

export function Sidebar({ role, userName, moduleAdminOf }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const stored = localStorage.getItem("sidebar-collapsed")
      if (stored === "true") setCollapsed(true)
    } catch {}
  }, [])

  function toggleCollapsed() {
    const next = !collapsed
    setCollapsed(next)
    try { localStorage.setItem("sidebar-collapsed", String(next)) } catch {}
  }

  const activeModule = pathname.startsWith("/regulatory")
    ? "regulatory"
    : pathname.startsWith("/recruitment")
    ? "recruitment"
    : pathname.startsWith("/crm")
    ? "crm"
    : null

  const isModuleAdmin = activeModule ? moduleAdminOf.includes(activeModule as Module) : false
  const isSuperAdmin = role === "super_admin"

  const allNavItems = activeModule ? moduleNavItems[activeModule] ?? [] : []
  const regularItems = allNavItems.filter(item => !item.adminOnly && !item.superAdminOnly)
  const adminItems   = allNavItems.filter(item => {
    if (item.superAdminOnly) return isSuperAdmin
    if (item.adminOnly)      return isModuleAdmin || isSuperAdmin
    return false
  })

  const ModuleIcon = activeModule ? moduleIcons[activeModule] : LayoutGrid

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  const ThemeIcon = !mounted ? Monitor : theme === "dark" ? Moon : theme === "light" ? Sun : Monitor

  return (
    <aside
      className={cn(
        "flex flex-col h-screen sticky top-0 bg-sidebar border-r border-sidebar-border overflow-hidden transition-all duration-200 shrink-0",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo / module header */}
      {activeModule ? (
        <Link
          href="/home"
          title={collapsed ? moduleLabels[activeModule] : undefined}
          className={cn(
            "flex items-center border-b border-sidebar-border shrink-0 hover:bg-sidebar-accent/40 transition-colors group",
            collapsed ? "justify-center py-5 px-2" : "gap-2 px-6 py-5"
          )}
        >
          {!collapsed && (
            <ChevronLeft className="h-4 w-4 text-sidebar-foreground/50 group-hover:text-sidebar-foreground transition-colors shrink-0" />
          )}
          <ModuleIcon className="h-5 w-5 text-sidebar-primary shrink-0" />
          {!collapsed && (
            <span className="font-semibold text-sidebar-foreground truncate">
              {moduleLabels[activeModule]}
            </span>
          )}
        </Link>
      ) : (
        <Link
          href="/home"
          title={collapsed ? "CS Executive Group Portal" : undefined}
          className={cn(
            "flex items-center border-b border-sidebar-border shrink-0 hover:bg-sidebar-accent/40 transition-colors",
            collapsed ? "justify-center py-5 px-2" : "gap-2 px-6 py-5"
          )}
        >
          <LayoutGrid className="h-5 w-5 text-sidebar-primary shrink-0" />
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="font-semibold text-sidebar-foreground text-sm">CS Executive Group</span>
              <span className="font-semibold text-sidebar-foreground text-sm">Portal</span>
            </div>
          )}
        </Link>
      )}

      {/* Navigation */}
      <nav className={cn("flex-1 py-4 space-y-1 overflow-y-auto", collapsed ? "px-2" : "px-3")}>
        {activeModule && regularItems.length > 0 && (
          <div className="space-y-1">
            {regularItems.map(item => (
              <NavLink key={item.href} item={item} collapsed={collapsed} pathname={pathname} />
            ))}
          </div>
        )}

        {activeModule && adminItems.length > 0 && (
          <div className={cn("pt-2 mt-2 space-y-1", !collapsed && "border-t border-sidebar-border")}>
            {collapsed
              ? <div className="border-t border-sidebar-border mb-2" />
              : (
                <p className="px-3 py-1 text-xs font-semibold text-sidebar-foreground/40 uppercase tracking-wider">
                  Admin Functions
                </p>
              )
            }
            {adminItems.map(item => (
              <NavLink key={item.href} item={item} collapsed={collapsed} pathname={pathname} />
            ))}
          </div>
        )}

        {isSuperAdmin && !activeModule && (
          <div className={cn("pt-2 mt-2 space-y-1", !collapsed && "border-t border-sidebar-border")}>
            {collapsed
              ? <div className="border-t border-sidebar-border mb-2" />
              : (
                <p className="px-3 py-1 text-xs font-semibold text-sidebar-foreground/40 uppercase tracking-wider">
                  Platform
                </p>
              )
            }
            <Link
              href="/admin/users"
              title={collapsed ? "Users" : undefined}
              className={cn(
                "flex items-center rounded-md text-sm font-medium transition-colors",
                collapsed ? "justify-center p-2" : "gap-3 px-3 py-2",
                pathname.startsWith("/admin/users")
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
              )}
            >
              <Users className="h-4 w-4 shrink-0" />
              {!collapsed && "Users"}
            </Link>
            <Link
              href="/admin/domains"
              title={collapsed ? "Access Domains" : undefined}
              className={cn(
                "flex items-center rounded-md text-sm font-medium transition-colors",
                collapsed ? "justify-center p-2" : "gap-3 px-3 py-2",
                pathname.startsWith("/admin/domains")
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
              )}
            >
              <Globe className="h-4 w-4 shrink-0" />
              {!collapsed && "Access Domains"}
            </Link>
          </div>
        )}
      </nav>

      {/* Collapse toggle */}
      <div className={cn("shrink-0 pb-1", collapsed ? "px-2 flex justify-center" : "px-3")}>
        <button
          onClick={toggleCollapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "flex items-center rounded-md text-sidebar-foreground/40 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground transition-colors text-xs font-medium",
            collapsed ? "p-2" : "w-full gap-2 px-3 py-2"
          )}
        >
          {collapsed
            ? <ChevronsRight className="h-4 w-4" />
            : <><ChevronsLeft className="h-4 w-4" />Collapse</>
          }
        </button>
      </div>

      {/* User + settings */}
      <div className={cn("py-3 border-t border-sidebar-border shrink-0", collapsed ? "px-2" : "px-3 space-y-1")}>
        {collapsed ? (
          <div className="flex flex-col items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  title={userName ?? "User"}
                  className="h-9 w-9 text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="end" className="w-48">
                <DropdownMenuLabel className="font-normal">
                  <p className="text-sm font-medium">{userName ?? "User"}</p>
                  <p className="text-xs text-muted-foreground">{isSuperAdmin ? "Super Admin" : "User"}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Appearance</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setTheme("light")} className="gap-2 cursor-pointer">
                  <Sun className="h-4 w-4" />Light
                  {mounted && theme === "light" && <span className="ml-auto text-xs opacity-60">✓</span>}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("dark")} className="gap-2 cursor-pointer">
                  <Moon className="h-4 w-4" />Dark
                  {mounted && theme === "dark" && <span className="ml-auto text-xs opacity-60">✓</span>}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("system")} className="gap-2 cursor-pointer">
                  <Monitor className="h-4 w-4" />System
                  {mounted && theme === "system" && <span className="ml-auto text-xs opacity-60">✓</span>}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="gap-2 cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="h-4 w-4" />Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-2 py-1">
              <div className="min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">{userName ?? "User"}</p>
                <p className="text-xs text-sidebar-foreground/60">{isSuperAdmin ? "Super Admin" : "User"}</p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="end" className="w-44">
                  <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Appearance</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => setTheme("light")} className="gap-2 cursor-pointer">
                    <Sun className="h-4 w-4" />Light
                    {mounted && theme === "light" && <span className="ml-auto text-xs opacity-60">✓</span>}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTheme("dark")} className="gap-2 cursor-pointer">
                    <Moon className="h-4 w-4" />Dark
                    {mounted && theme === "dark" && <span className="ml-auto text-xs opacity-60">✓</span>}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTheme("system")} className="gap-2 cursor-pointer">
                    <Monitor className="h-4 w-4" />System
                    {mounted && theme === "system" && <span className="ml-auto text-xs opacity-60">✓</span>}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="gap-2 cursor-pointer text-destructive focus:text-destructive">
                    <LogOut className="h-4 w-4" />Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-3 text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground text-xs h-8"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              <ThemeIcon className="h-3.5 w-3.5" />
              {!mounted ? "System theme" : theme === "dark" ? "Dark mode" : theme === "light" ? "Light mode" : "System theme"}
            </Button>
          </>
        )}
      </div>
    </aside>
  )
}
