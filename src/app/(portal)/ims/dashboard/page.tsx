import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/layout/PageHeader"
import { Monitor, Globe, Wifi, Shield } from "lucide-react"
import Link from "next/link"

export default async function ImsDashboardPage() {
  const supabase = await createClient()
  const ims = supabase.schema("ims")

  const [
    { count: computerCount },
    { count: serviceAccountCount },
    { count: wifiCount },
    { count: vpnCount },
  ] = await Promise.all([
    ims.from("computers").select("*", { count: "exact", head: true }),
    ims.from("service_accounts").select("*", { count: "exact", head: true }),
    ims.from("wifi_networks").select("*", { count: "exact", head: true }),
    ims.from("vpn_accounts").select("*", { count: "exact", head: true }),
  ])

  const cards = [
    { label: "Computers", href: "/ims/computers", count: computerCount ?? 0, icon: Monitor },
    { label: "Service Accounts", href: "/ims/service-accounts", count: serviceAccountCount ?? 0, icon: Globe },
    { label: "Wifi & Routers", href: "/ims/network", count: wifiCount ?? 0, icon: Wifi },
    { label: "VPN Accounts", href: "/ims/vpn", count: vpnCount ?? 0, icon: Shield },
  ]

  return (
    <div>
      <PageHeader title="IMS" description="IT inventory, logins, and credential references" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ label, href, count, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="border rounded-lg p-5 hover:bg-muted/30 transition-colors flex items-center gap-4"
          >
            <Icon className="h-8 w-8 text-muted-foreground shrink-0" />
            <div>
              <p className="text-2xl font-semibold">{count}</p>
              <p className="text-sm text-muted-foreground">{label}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
