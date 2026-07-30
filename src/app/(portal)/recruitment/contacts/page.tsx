import { requireModuleAccess } from "@/lib/auth-helpers"
import { createAdminClient } from "@/lib/supabase/admin"
import { PageHeader } from "@/components/layout/PageHeader"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { Star, Mail, Phone } from "lucide-react"
import { CrmStatusBadge } from "@/components/crm/CrmStatusBadge"

interface ContactRow {
  id: string
  company_id: string
  first_name: string
  last_name: string
  title: string | null
  department: string | null
  email: string | null
  phone: string | null
  is_primary: boolean
  is_crm_contact: boolean
  is_regulatory_contact: boolean
  is_recruitment_contact: boolean
}

interface CompanyInfo {
  id: string
  name: string
  crm_status: string | null
}

export default async function ContactsPage() {
  await requireModuleAccess("recruitment")
  const admin = createAdminClient()

  const { data: contacts } = await admin
    .from("contacts")
    .select("id, company_id, first_name, last_name, title, department, email, phone, is_primary, is_crm_contact, is_regulatory_contact, is_recruitment_contact")
    .eq("is_active", true)
    .order("last_name")
    .limit(200)

  const companyIds = [...new Set((contacts ?? []).map((c: ContactRow) => c.company_id))]
  const { data: companies } = companyIds.length
    ? await admin.from("companies").select("id, name, crm_status").in("id", companyIds)
    : { data: [] }
  const companyMap = Object.fromEntries((companies ?? []).map((c: CompanyInfo) => [c.id, c]))

  return (
    <div>
      <PageHeader title="Contacts" description="All contacts across client companies" />

      {!(contacts?.length) ? (
        <div className="border rounded-lg text-center py-16 text-muted-foreground text-sm">No contacts found.</div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-left px-4 py-3 font-medium">Title</th>
                <th className="text-left px-4 py-3 font-medium">Company</th>
                <th className="text-left px-4 py-3 font-medium">Email</th>
                <th className="text-left px-4 py-3 font-medium">Phone</th>
                <th className="text-left px-4 py-3 font-medium">Modules</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(contacts as ContactRow[]).map((c) => {
                const company = companyMap[c.company_id] as CompanyInfo | undefined
                return (
                  <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 font-medium">
                        {c.is_primary && <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500 shrink-0" />}
                        {c.first_name} {c.last_name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {[c.title, c.department].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="px-4 py-3">
                      {company ? (
                        <span className="flex items-center gap-1.5">
                          <Link href={`/recruitment/companies/${company.id}`} className="font-medium hover:underline">
                            {company.name}
                          </Link>
                          <CrmStatusBadge status={company.crm_status} />
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {c.email ? (
                        <a href={`mailto:${c.email}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                          <Mail className="h-3 w-3" />{c.email}
                        </a>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {c.phone ? (
                        <a href={`tel:${c.phone}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                          <Phone className="h-3 w-3" />{c.phone}
                        </a>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {c.is_crm_contact && <Badge variant="outline" className="text-xs">CRM</Badge>}
                        {c.is_regulatory_contact && <Badge variant="outline" className="text-xs">Regulatory</Badge>}
                        {c.is_recruitment_contact && <Badge variant="outline" className="text-xs">Recruitment</Badge>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
