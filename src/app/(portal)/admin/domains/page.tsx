import { requireSuperAdmin } from "@/lib/auth-helpers"
import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/layout/PageHeader"
import { Badge } from "@/components/ui/badge"
import { Globe } from "lucide-react"
import { formatDate } from "@/lib/date-helpers"
import { AddDomainForm } from "./AddDomainForm"
import { DeleteDomainButton } from "./DeleteDomainButton"

export default async function DomainsPage() {
  await requireSuperAdmin()
  const supabase = await createClient()

  const { data: domains } = await supabase
    .from("allowed_email_domains")
    .select("id, domain, added_at")
    .order("domain")

  return (
    <div>
      <PageHeader
        title="Access Domains"
        description="Only email addresses from these domains can self-register on the portal."
      />

      <div className="max-w-lg space-y-6">
        <div className="border rounded-lg overflow-hidden">
          {(domains ?? []).length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">No domains configured.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Domain</th>
                  <th className="text-left px-4 py-3 font-medium">Added</th>
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {(domains ?? []).map((d) => (
                  <tr key={d.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="font-mono text-sm">{d.domain}</span>
                        {d.domain === "csexecgroup.com" && (
                          <Badge variant="secondary" className="text-xs">Default</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(d.added_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <DeleteDomainButton domainId={d.id} domain={d.domain} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div>
          <h3 className="text-sm font-medium mb-2">Add a domain</h3>
          <AddDomainForm />
        </div>
      </div>
    </div>
  )
}
