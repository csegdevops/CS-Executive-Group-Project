import { requireAuth, getUserModules } from "@/lib/auth-helpers"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { FlaskConical, Users, Building2, Lock, ArrowRight } from "lucide-react"
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
    label: "Recruitment Database",
    description: "Manage job postings, candidates and hiring pipelines",
    href: "/recruitment/dashboard",
    icon: Users,
    colorClass: "text-green-600",
  },
  crm: {
    label: "CRM",
    description: "Client relationships, leads and account management",
    href: "/crm/dashboard",
    icon: Building2,
    colorClass: "text-purple-600",
  },
}

const allModules: Module[] = ["regulatory", "recruitment", "crm"]

export default async function HomePage() {
  const user = await requireAuth()
  const isSuperAdmin = user.role === "super_admin"
  const grantedModules = isSuperAdmin ? allModules : await getUserModules(user.id)
  const grantedSet = new Set(grantedModules)

  return (
    <div>
      <PageHeader
        title={`Welcome, ${user.full_name?.split(" ")[0] ?? "there"}`}
        description="Select a module to get started"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
        {allModules.map((mod) => {
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
