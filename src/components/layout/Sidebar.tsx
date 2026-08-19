"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { BrandHeader } from "@/components/layout/BrandHeader"
import { EditProfileDialog } from "@/components/layout/EditProfileDialog"
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
  UserCog,
  Contact,
  Clock,
  FileSignature,
  UserCheck,
  Server,
  Globe,
  Wifi,
  Shield,
} from "lucide-react"
import type { Role, Module } from "@/types/database"

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  /** If set, only shown when the user (or super_admin) holds this permission key. */
  permission?: string
  /** If set, looks up a live count from the `badges` map to render a small
   * number badge next to this item (e.g. incomplete contracts needing review). */
  badgeKey?: string
}

const moduleNavItems: Record<string, NavItem[]> = {
  regulatory: [
    { label: "Dashboard",        href: "/regulatory/dashboard",                icon: LayoutDashboard },
    { label: "Consultations",    href: "/regulatory/consultations",            icon: FileText },
    { label: "Companies",        href: "/regulatory/companies",                icon: Building2 },
    { label: "Chemicals",        href: "/regulatory/chemicals",                icon: Beaker },
    { label: "Regulatory Lists", href: "/regulatory/admin/regulatory-lists",   icon: Database,       permission: "regulatory.regulatory_lists.manage" },
  ],
  recruitment: [
    { label: "Dashboard",    href: "/recruitment/dashboard",           icon: LayoutDashboard },
    { label: "Jobs",         href: "/recruitment/jobs",                icon: Briefcase },
    { label: "Applications", href: "/recruitment/applications",        icon: ClipboardList },
    { label: "Candidates",   href: "/recruitment/candidates",          icon: UserSearch },
    { label: "Contractors",  href: "/recruitment/contractors",         icon: UserCheck, badgeKey: "incompleteContracts" },
    { label: "Companies",    href: "/recruitment/companies",           icon: Building2 },
    { label: "Contacts",     href: "/recruitment/contacts",            icon: Contact },
    { label: "Pipeline",     href: "/recruitment/pipeline",            icon: TrendingUp },
    { label: "Tasks",        href: "/recruitment/tasks",               icon: ListChecks },
    { label: "Activities",   href: "/recruitment/activities",          icon: CalendarClock },
  ],
  timesheets: [
    { label: "Dashboard",    href: "/timesheets/dashboard",            icon: LayoutDashboard },
    { label: "Contractors",  href: "/timesheets/contractors",          icon: UserCheck },
    { label: "Contracts",    href: "/timesheets/contracts",            icon: FileSignature },
    { label: "Supervisors",  href: "/timesheets/supervisors",          icon: Contact },
    { label: "Timesheets",   href: "/timesheets/timesheets",           icon: ClipboardList },
  ],
  ims: [
    { label: "Dashboard",        href: "/ims/dashboard",               icon: LayoutDashboard },
    { label: "Computers",        href: "/ims/computers",               icon: Monitor },
    { label: "Service Accounts", href: "/ims/service-accounts",        icon: Globe },
    { label: "Network",          href: "/ims/network",                 icon: Wifi },
    { label: "VPN Accounts",     href: "/ims/vpn",                     icon: Shield },
  ],
}

const moduleLabels: Record<string, string> = {
  regulatory: "Regulatory DB",
  recruitment: "Recruitment",
  timesheets: "Timesheets",
  ims: "IMS",
}

const moduleIcons: Record<string, React.ElementType> = {
  regulatory: FlaskConical,
  recruitment: Users,
  timesheets: Clock,
  ims: Server,
}

const moduleHrefs: Record<string, string> = {
  regulatory: "/regulatory/dashboard",
  recruitment: "/recruitment/dashboard",
  timesheets: "/timesheets/dashboard",
  ims: "/ims/dashboard",
}

interface SidebarProps {
  role: Role
  userName: string | null
  email: string
  /** null = super_admin, who implicitly holds every permission */
  permissionKeys: string[] | null
  /** Modules this user can switch to (enabled system-wide AND granted to them) */
  accessibleModules: Module[]
}

function NavLink({ item, collapsed, pathname, badgeCount }: { item: NavItem; collapsed: boolean; pathname: string; badgeCount?: number }) {
  const Icon = item.icon
  const isActive = item.href.endsWith("/dashboard")
    ? pathname === item.href
    : pathname.startsWith(item.href)

  return (
    <Link
      href={item.href}
      title={collapsed ? (badgeCount ? `${item.label} (${badgeCount} incomplete)` : item.label) : undefined}
      className={cn(
        "flex items-center rounded-md text-sm font-medium transition-colors",
        collapsed
          ? "justify-center p-2 relative"
          : "gap-3 px-3 py-2",
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
      )}
    >
      <span className="relative shrink-0">
        <Icon className="h-4 w-4" />
        {collapsed && !!badgeCount && (
          <span className="absolute -top-1.5 -right-1.5 h-3.5 min-w-3.5 px-0.5 rounded-full bg-red-500 text-white text-[9px] leading-3.5 text-center">
            {badgeCount > 9 ? "9+" : badgeCount}
          </span>
        )}
      </span>
      {!collapsed && (
        <span className="flex-1 flex items-center justify-between gap-2">
          {item.label}
          {!!badgeCount && (
            <span className="h-4 min-w-4 px-1 rounded-full bg-red-500 text-white text-[10px] leading-4 text-center">
              {badgeCount > 99 ? "99+" : badgeCount}
            </span>
          )}
        </span>
      )}
    </Link>
  )
}

export function Sidebar({ role, userName, email, permissionKeys, accessibleModules }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [editProfileOpen, setEditProfileOpen] = useState(false)
  const [badges, setBadges] = useState<Record<string, number>>({})

  useEffect(() => {
    setMounted(true)
    try {
      const stored = localStorage.getItem("sidebar-collapsed")
      if (stored === "true") setCollapsed(true)
    } catch {}
  }, [])

  const isRecruitmentModule = pathname.startsWith("/recruitment")
  useEffect(() => {
    if (!isRecruitmentModule) return
    fetch("/api/recruitment/contracts/incomplete-count")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setBadges(b => ({ ...b, incompleteContracts: d.count })) })
      .catch(() => {})
  }, [isRecruitmentModule])

  function toggleCollapsed() {
    const next = !collapsed
    setCollapsed(next)
    try { localStorage.setItem("sidebar-collapsed", String(next)) } catch {}
  }

  const activeModule = pathname.startsWith("/regulatory")
    ? "regulatory"
    : pathname.startsWith("/recruitment")
    ? "recruitment"
    : pathname.startsWith("/timesheets")
    ? "timesheets"
    : pathname.startsWith("/ims")
    ? "ims"
    : null

  const isSuperAdmin = role === "super_admin"
  const hasPerm = (key: string) => isSuperAdmin || (permissionKeys?.includes(key) ?? false)
  const canViewPlatformSettings = hasPerm("platform_settings.view") || hasPerm("ai.pause.manage")

  const allNavItems = activeModule ? moduleNavItems[activeModule] ?? [] : []
  const regularItems = allNavItems.filter(item => !item.permission)
  const adminItems   = allNavItems.filter(item => item.permission && hasPerm(item.permission))

  const ModuleIcon = activeModule ? moduleIcons[activeModule] : LayoutGrid

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  const ThemeIcon = !mounted ? Monitor : theme === "dark" ? Moon : theme === "light" ? Sun : Monitor

  function cycleTheme() {
    setTheme(theme === "light" ? "dark" : theme === "dark" ? "system" : "light")
  }

  return (
    <aside
      className={cn(
        "flex flex-col h-screen sticky top-0 bg-sidebar border-r border-sidebar-border overflow-hidden transition-all duration-200 shrink-0",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo / module header */}
      {activeModule ? (
        accessibleModules.length > 1 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                title={collapsed ? moduleLabels[activeModule] : undefined}
                className={cn(
                  "flex w-full border-b border-sidebar-border shrink-0 hover:bg-sidebar-accent/40 transition-colors group text-left",
                  collapsed ? "items-center justify-center py-5 px-2" : "flex-col gap-0.5 px-6 py-4"
                )}
              >
                {collapsed ? (
                  <ModuleIcon className="h-5 w-5 text-sidebar-primary shrink-0" />
                ) : (
                  <>
                    <span className="flex items-center gap-1 text-xs text-sidebar-foreground/50 group-hover:text-sidebar-foreground transition-colors">
                      <ChevronLeft className="h-3 w-3 shrink-0" />
                      Switch module
                    </span>
                    <span className="flex items-center gap-2 font-semibold text-sidebar-foreground truncate">
                      <ModuleIcon className="h-5 w-5 text-sidebar-primary shrink-0" />
                      {moduleLabels[activeModule]}
                    </span>
                  </>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side={collapsed ? "right" : "bottom"} align="start" className="w-56">
              <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Modules</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {accessibleModules.map((m) => {
                const Icon = moduleIcons[m]
                return (
                  <DropdownMenuItem
                    key={m}
                    disabled={m === activeModule}
                    onClick={() => router.push(moduleHrefs[m])}
                    className="gap-2 cursor-pointer"
                  >
                    <Icon className="h-4 w-4" />
                    {moduleLabels[m]}
                    {m === activeModule && <span className="ml-auto text-xs text-muted-foreground">Current</span>}
                  </DropdownMenuItem>
                )
              })}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/home")} className="gap-2 cursor-pointer">
                <LayoutGrid className="h-4 w-4" />
                All modules
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Link
            href="/home"
            title={collapsed ? moduleLabels[activeModule] : undefined}
            className={cn(
              "flex border-b border-sidebar-border shrink-0 hover:bg-sidebar-accent/40 transition-colors group",
              collapsed ? "items-center justify-center py-5 px-2" : "flex-col gap-0.5 px-6 py-4"
            )}
          >
            {collapsed ? (
              <ModuleIcon className="h-5 w-5 text-sidebar-primary shrink-0" />
            ) : (
              <>
                <span className="flex items-center gap-1 text-xs text-sidebar-foreground/50 group-hover:text-sidebar-foreground transition-colors">
                  <ChevronLeft className="h-3 w-3 shrink-0" />
                  Home
                </span>
                <span className="flex items-center gap-2 font-semibold text-sidebar-foreground truncate">
                  <ModuleIcon className="h-5 w-5 text-sidebar-primary shrink-0" />
                  {moduleLabels[activeModule]}
                </span>
              </>
            )}
          </Link>
        )
      ) : (
        <Link
          href="/home"
          title={collapsed ? "CS Executive Group Portal" : undefined}
          className={cn(
            "flex items-center border-b border-sidebar-border shrink-0 hover:bg-sidebar-accent/40 transition-colors",
            collapsed ? "justify-center py-5 px-2" : "gap-2 px-6 py-5"
          )}
        >
          {collapsed ? (
            <BrandHeader variant="icon" height={28} />
          ) : (
            <BrandHeader variant="full" height={32} />
          )}
        </Link>
      )}

      {/* Navigation */}
      <nav className={cn("flex-1 py-4 space-y-1 overflow-y-auto", collapsed ? "px-2" : "px-3")}>
        {activeModule && regularItems.length > 0 && (
          <div className="space-y-1">
            {regularItems.map(item => (
              <NavLink key={item.href} item={item} collapsed={collapsed} pathname={pathname} badgeCount={item.badgeKey ? badges[item.badgeKey] : undefined} />
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
              <NavLink key={item.href} item={item} collapsed={collapsed} pathname={pathname} badgeCount={item.badgeKey ? badges[item.badgeKey] : undefined} />
            ))}
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
                <DropdownMenuItem onClick={() => setEditProfileOpen(true)} className="gap-2 cursor-pointer">
                  <UserCog className="h-4 w-4" />Edit Profile
                </DropdownMenuItem>
                {canViewPlatformSettings && (
                  <DropdownMenuItem onClick={() => router.push("/admin/settings")} className="gap-2 cursor-pointer">
                    <Settings className="h-4 w-4" />Platform Settings
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="gap-2 cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="h-4 w-4" />Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="icon"
              onClick={cycleTheme}
              title={!mounted ? "System theme" : theme === "dark" ? "Dark mode" : theme === "light" ? "Light mode" : "System theme"}
              className="h-9 w-9 text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
            >
              <ThemeIcon className="h-4 w-4" />
            </Button>
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
                  <DropdownMenuItem onClick={() => setEditProfileOpen(true)} className="gap-2 cursor-pointer">
                    <UserCog className="h-4 w-4" />Edit Profile
                  </DropdownMenuItem>
                  {canViewPlatformSettings && (
                    <DropdownMenuItem onClick={() => router.push("/admin/settings")} className="gap-2 cursor-pointer">
                      <Settings className="h-4 w-4" />Platform Settings
                    </DropdownMenuItem>
                  )}
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
              onClick={cycleTheme}
            >
              <ThemeIcon className="h-3.5 w-3.5" />
              {!mounted ? "System theme" : theme === "dark" ? "Dark mode" : theme === "light" ? "Light mode" : "System theme"}
            </Button>
          </>
        )}
      </div>

      <EditProfileDialog
        open={editProfileOpen}
        onOpenChange={setEditProfileOpen}
        userName={userName}
        email={email}
      />
    </aside>
  )
}
