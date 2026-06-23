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
  LayoutGrid,
  Globe,
  Settings,
  Sun,
  Moon,
  Monitor,
} from "lucide-react"
import type { Role, Module } from "@/types/database"

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  adminOnly?: boolean      // visible to module admins and super_admin
  superAdminOnly?: boolean // visible to super_admin only
}

const moduleNavItems: Record<string, NavItem[]> = {
  regulatory: [
    { label: "Dashboard",    href: "/regulatory/dashboard",    icon: LayoutDashboard },
    { label: "Consultations",href: "/regulatory/consultations", icon: FileText },
    { label: "Companies",    href: "/regulatory/companies",    icon: Building2 },
    { label: "Chemicals",    href: "/regulatory/chemicals",     icon: Beaker },
    { label: "Regulatory Lists",  href: "/regulatory/admin/regulatory-lists",  icon: Database,  adminOnly: true },
    { label: "Users",             href: "/regulatory/admin/users",              icon: Users,     adminOnly: true },
  ],
  recruitment: [
    { label: "Dashboard", href: "/recruitment/dashboard", icon: LayoutDashboard },
    { label: "Users",     href: "/recruitment/admin/users", icon: Users,         adminOnly: true },
  ],
  crm: [
    { label: "Dashboard", href: "/crm/dashboard", icon: LayoutDashboard },
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

export function Sidebar({ role, userName, moduleAdminOf }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const activeModule = pathname.startsWith("/regulatory")
    ? "regulatory"
    : pathname.startsWith("/recruitment")
    ? "recruitment"
    : pathname.startsWith("/crm")
    ? "crm"
    : null

  const isModuleAdmin = activeModule ? moduleAdminOf.includes(activeModule as Module) : false

  const allNavItems = activeModule ? moduleNavItems[activeModule] ?? [] : []
  const isSuperAdmin = role === "super_admin"

  const regularItems = allNavItems.filter((item) => !item.adminOnly && !item.superAdminOnly)
  const adminItems   = allNavItems.filter((item) => {
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
    <aside className="flex flex-col w-64 h-screen sticky top-0 bg-sidebar border-r border-sidebar-border overflow-hidden">
      {/* Logo / module header */}
      <div className="flex items-center gap-2 px-6 py-5 border-b border-sidebar-border shrink-0">
        <ModuleIcon className="h-6 w-6 text-sidebar-primary" />
        <span className="font-semibold text-sidebar-foreground">
          {activeModule ? moduleLabels[activeModule] : "Platform"}
        </span>
      </div>

      {/* Navigation — scrollable so long lists don't push user section off screen */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <Link
          href="/home"
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors mb-2",
            !activeModule
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
          )}
        >
          <ChevronLeft className="h-4 w-4 shrink-0" />
          All Modules
        </Link>

        {activeModule && regularItems.length > 0 && (
          <div className="border-t border-sidebar-border pt-2 space-y-1">
            {regularItems.map((item) => {
              const Icon = item.icon
              const isActive = item.href.endsWith("/dashboard")
                ? pathname === item.href
                : pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              )
            })}
          </div>
        )}

        {activeModule && adminItems.length > 0 && (
          <div className="border-t border-sidebar-border pt-2 mt-2 space-y-1">
            <p className="px-3 py-1 text-xs font-semibold text-sidebar-foreground/40 uppercase tracking-wider">
              Admin Functions
            </p>
            {adminItems.map((item) => {
              const Icon = item.icon
              const isActive = item.href.endsWith("/dashboard")
                ? pathname === item.href
                : pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              )
            })}
          </div>
        )}

        {role === "super_admin" && !activeModule && (
          <div className="border-t border-sidebar-border pt-2 mt-2 space-y-1">
            <p className="px-3 py-1 text-xs font-semibold text-sidebar-foreground/40 uppercase tracking-wider">
              Platform
            </p>
            <Link
              href="/admin/users"
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                pathname.startsWith("/admin/users")
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
              )}
            >
              <Users className="h-4 w-4 shrink-0" />
              Users
            </Link>
            <Link
              href="/admin/domains"
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                pathname.startsWith("/admin/domains")
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
              )}
            >
              <Globe className="h-4 w-4 shrink-0" />
              Access Domains
            </Link>
          </div>
        )}
      </nav>

      {/* User + settings — always visible, never scrolls away */}
      <div className="px-3 py-3 border-t border-sidebar-border shrink-0 space-y-1">
        <div className="flex items-center justify-between px-2 py-1">
          <div className="min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {userName ?? "User"}
            </p>
            <p className="text-xs text-sidebar-foreground/60">
              {role === "super_admin" ? "Super Admin" : "User"}
            </p>
          </div>

          {/* Settings dropdown */}
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
              <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                Appearance
              </DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setTheme("light")} className="gap-2 cursor-pointer">
                <Sun className="h-4 w-4" />
                Light
                {mounted && theme === "light" && <span className="ml-auto text-xs opacity-60">✓</span>}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("dark")} className="gap-2 cursor-pointer">
                <Moon className="h-4 w-4" />
                Dark
                {mounted && theme === "dark" && <span className="ml-auto text-xs opacity-60">✓</span>}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("system")} className="gap-2 cursor-pointer">
                <Monitor className="h-4 w-4" />
                System
                {mounted && theme === "system" && <span className="ml-auto text-xs opacity-60">✓</span>}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="gap-2 cursor-pointer text-destructive focus:text-destructive">
                <LogOut className="h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Quick theme toggle icon shown below name for visibility */}
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-3 text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground text-xs h-8"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          <ThemeIcon className="h-3.5 w-3.5" />
          {!mounted ? "System theme" : theme === "dark" ? "Dark mode" : theme === "light" ? "Light mode" : "System theme"}
        </Button>
      </div>
    </aside>
  )
}
