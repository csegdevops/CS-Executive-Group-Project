import { requireAuth, getUserModules, getEnabledModules } from "@/lib/auth-helpers"
import { createAdminClient } from "@/lib/supabase/admin"
import { getCrmSummary } from "@/lib/crm/summary"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { FlaskConical, Users, Lock, ArrowRight, Clock } from "lucide-react"
import type { Module } from "@/types/database"

interface ModuleConfig {
  label: string
  description: string
  href: string
  icon: React.ElementType
  colorClass: string
}

const moduleConfig: Record<Module, ModuleConfig> = {
  regulatory: {
    label: "Regulatory Database",
    description: "AICIS, REACH, TSCA compliance and chemical assessments",
    href: "/regulatory/dashboard",
    icon: FlaskConical,
    colorClass: "text-blue-600",
  },
  recruitment: {
    label: "Recruitment",
    description: "Jobs, candidates, and client relationships in one place",
    href: "/recruitment/dashboard",
    icon: Users,
    colorClass: "text-green-600",
  },
  timesheets: {
    label: "Timesheets",
    description: "Contractor timesheets, approvals, and contracts",
    href: "/timesheets/dashboard",
    icon: Clock,
    colorClass: "text-amber-600",
  },
}

const allModules: Module[] = ["regulatory", "recruitment", "timesheets"]

export default async function HomePage() {
  const user = await requireAuth()
  const isSuperAdmin = user.role === "super_admin"
  const [grantedModules, enabledModules] = await Promise.all([
    isSuperAdmin ? Promise.resolve(allModules) : getUserModules(user.id),
    getEnabledModules(),
  ])
  const grantedSet = new Set(grantedModules)
  const enabledSet = new Set(enabledModules)
  const visibleModules = allModules.filter((m) => enabledSet.has(m))

  const crmSummary = visibleModules.includes("recruitment") && grantedSet.has("recruitment")
    ? await getCrmSummary(createAdminClient())
    : null

  return (
    <div>
      <PageHeader
        title={`Welcome, ${user.full_name?.split(" ")[0] ?? "there"}`}
        description="Select a module to get started"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
        {visibleModules.map((mod) => {
          const config = moduleConfig[mod]
          const Icon = config.icon
          const hasAccess = grantedSet.has(mod)

          if (!hasAccess) {
            return (
              <Card key={mod} className="opacity-50 cursor-not-allowed">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <Lock className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-base">{config.label}</CardTitle>
                  </div>
                  <CardDescription className="text-sm">{config.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Badge variant="outline" className="text-xs text-muted-foreground">No access</Badge>
                </CardContent>
              </Card>
            )
          }

          return (
            <Link key={mod} href={config.href} className="block group">
              <Card className="h-full transition-shadow group-hover:shadow-md group-hover:border-foreground/20">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <Icon className={`h-5 w-5 ${config.colorClass}`} />
                    <CardTitle className="text-base">{config.label}</CardTitle>
                  </div>
                  <CardDescription className="text-sm">{config.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  {mod === "recruitment" && crmSummary && (
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                      <span>
                        Pipeline: <span className="font-medium text-foreground">
                          {crmSummary.pipelineValueAud > 0 ? `AUD ${crmSummary.pipelineValueAud.toLocaleString()}` : "—"}
                        </span>
                      </span>
                      {crmSummary.dormantAccounts.length > 0 && (
                        <span className="flex items-center gap-1 text-amber-600">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                          {crmSummary.dormantAccounts.length} dormant
                        </span>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                    Open <ArrowRight className="h-3 w-3" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
