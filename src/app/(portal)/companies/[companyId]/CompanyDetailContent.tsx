import { createAdminClient } from "@/lib/supabase/admin"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, Building2, Star, Phone, Mail, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDate, formatDistanceToNow } from "@/lib/date-helpers"
import { BranchesContactsTab } from "./BranchesContactsTab"
import { ActivityTab } from "./ActivityTab"
import { EditCompanyDialog } from "./EditCompanyDialog"
import { NewOpportunityDialog } from "./NewOpportunityDialog"
import { formatAddress } from "@/lib/address"
import type { AuthUser } from "@/lib/auth-helpers"

const CRM_STATUS_STYLES: Record<string, string> = {
  lead:     "bg-slate-100 text-slate-700 border-slate-200",
  prospect: "bg-blue-50  text-blue-700  border-blue-200",
  client:   "bg-green-50 text-green-700 border-green-200",
  inactive: "bg-red-50   text-red-700   border-red-200",
}

const STAGE_STYLES: Record<string, string> = {
  lead:        "bg-slate-100 text-slate-700",
  qualified:   "bg-blue-50   text-blue-700",
  proposal:    "bg-purple-50 text-purple-700",
  negotiation: "bg-amber-50  text-amber-700",
  won:         "bg-green-50  text-green-700",
  lost:        "bg-red-50    text-red-700",
}

type Tab = "overview" | "contacts" | "activity" | "regulatory" | "recruitment" | "pipeline"

interface Props {
  companyId: string
  tab: string
  /** URL of the back link (e.g. "/regulatory/companies") */
  backHref: string
  /** Label for the back link (e.g. "Companies") */
  backLabel: string
  /** Base URL for ?tab= links — must match the current route (e.g. "/regulatory/companies/abc123") */
  basePath: string
  user: AuthUser
}

export async function CompanyDetailContent({ companyId, tab, backHref, backLabel, basePath, user }: Props) {
  const admin = createAdminClient()

  const [
    { data: company },
    { data: contacts },
    { data: branches },
    { data: activities },
    { data: consultations },
    { data: jobs },
    { data: opportunities },
  ] = await Promise.all([
    admin.from("companies").select("*").eq("id", companyId).single(),
    admin.from("contacts").select("*").eq("company_id", companyId).eq("is_active", true).order("is_primary", { ascending: false }).order("last_name"),
    admin.from("company_branches").select("*").eq("company_id", companyId).eq("is_active", true).order("is_head_office", { ascending: false }).order("name"),
    admin.from("company_activities").select("*").eq("company_id", companyId).order("occurred_at", { ascending: false }).limit(50),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin.schema("regulatory") as any).from("consultations").select("id, title, status, reference_number, due_date, created_at").eq("company_id", companyId).order("created_at", { ascending: false }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin.schema("recruitment") as any).from("jobs").select("id, title, status, reference_number, location, employment_type, created_at").eq("company_id", companyId).order("created_at", { ascending: false }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin.schema("crm") as any).from("opportunities").select("*").eq("company_id", companyId).order("created_at", { ascending: false }),
  ])

  if (!company) notFound()

  const { data: allProfiles } = await admin.from("profiles").select("id, full_name").eq("is_active", true).order("full_name")
  const profileMap = Object.fromEntries((allProfiles ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name]))
  const contactMap = Object.fromEntries((contacts ?? []).map((c: { id: string; first_name: string; last_name: string }) => [c.id, `${c.first_name} ${c.last_name}`]))

  const enrichedActivities = (activities ?? []).map((a: Record<string, unknown>) => ({
    ...a,
    performer_name: profileMap[a.performed_by as string] ?? null,
    contact_name: a.contact_id ? (contactMap[a.contact_id as string] ?? null) : null,
  }))

  let accountOwnerName: string | null = null
  if (company.account_owner_id) {
    const { data: owner } = await admin.from("profiles").select("full_name").eq("id", company.account_owner_id).single()
    accountOwnerName = owner?.full_name ?? null
  }

  const openOpps = (opportunities ?? []).filter((o: { stage: string }) => !["won", "lost"].includes(o.stage))
  const primaryContact = (contacts ?? []).find((c: { is_primary: boolean }) => c.is_primary)

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "overview",    label: "Overview" },
    { id: "contacts",    label: "Contacts",    count: (contacts ?? []).length },
    { id: "activity",    label: "Activity",    count: (activities ?? []).length },
    { id: "regulatory",  label: "Regulatory",  count: (consultations ?? []).length },
    { id: "recruitment", label: "Recruitment", count: (jobs ?? []).length },
    { id: "pipeline",    label: "Pipeline",    count: openOpps.length },
  ]

  const typedProfiles = (allProfiles ?? []).map((p: { id: string; full_name: string | null }) => ({ id: p.id, full_name: p.full_name }))

  return (
    <div>
      <Link href={backHref} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
        <ChevronLeft className="h-3.5 w-3.5" />
        {backLabel}
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-2xl font-semibold">{company.name}</h1>
            <Badge variant="outline" className={cn("text-xs capitalize", CRM_STATUS_STYLES[company.crm_status ?? "prospect"])}>
              {company.crm_status ?? "prospect"}
            </Badge>
            {!company.is_active && (
              <Badge variant="outline" className="text-xs text-muted-foreground">Archived</Badge>
            )}
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
            {company.industry    && <span>{company.industry}</span>}
            {company.country     && <span>{company.country}</span>}
            {company.abn         && <span className="font-mono text-xs">ABN {company.abn}</span>}
            {accountOwnerName    && <span>Owner: {accountOwnerName}</span>}
            {company.last_activity_at && (
              <span>Last activity: {formatDistanceToNow(company.last_activity_at)}</span>
            )}
          </div>
        </div>
        <div className="shrink-0">
          <EditCompanyDialog company={company} profiles={typedProfiles} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b mb-6 overflow-x-auto">
        {tabs.map(t => (
          <Link
            key={t.id}
            href={`${basePath}?tab=${t.id}`}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap flex items-center gap-1.5",
              (tab as Tab) === t.id
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className="text-xs bg-muted px-1.5 py-0.5 rounded-full">{t.count}</span>
            )}
          </Link>
        ))}
      </div>

      {/* Overview */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold">Company details</h3>
              {[
                { label: "Name",     value: company.name },
                { label: "ABN",      value: company.abn },
                { label: "Industry", value: company.industry },
                { label: "Address",  value: formatAddress({ address_line1: company.address_line1 ?? undefined, address_line2: company.address_line2 ?? undefined, suburb: company.suburb ?? undefined, state: company.state ?? undefined, postcode: company.postcode ?? undefined, country: company.country ?? undefined }) || null },
                { label: "Status",   value: company.is_active ? "Active" : "Archived" },
                { label: "Notes",    value: company.notes },
              ].map(({ label, value }) => value ? (
                <div key={label} className="flex gap-2 text-sm">
                  <span className="text-muted-foreground w-20 shrink-0">{label}</span>
                  <span>{value}</span>
                </div>
              ) : null)}
            </div>

            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold">CRM snapshot</h3>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="border rounded-md p-2">
                  <p className="text-xl font-bold">{(consultations ?? []).length}</p>
                  <p className="text-xs text-muted-foreground">Consultations</p>
                </div>
                <div className="border rounded-md p-2">
                  <p className="text-xl font-bold">{(jobs ?? []).length}</p>
                  <p className="text-xs text-muted-foreground">Jobs</p>
                </div>
                <div className="border rounded-md p-2">
                  <p className="text-xl font-bold">{openOpps.length}</p>
                  <p className="text-xs text-muted-foreground">Open opps</p>
                </div>
              </div>
              {company.last_activity_at && (
                <p className="text-xs text-muted-foreground">Last activity: {formatDate(company.last_activity_at)}</p>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {primaryContact && (
              <div className="border rounded-lg p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                  <h3 className="text-sm font-semibold">Primary contact</h3>
                </div>
                <p className="font-medium text-sm">{(primaryContact as { first_name: string; last_name: string }).first_name} {(primaryContact as { last_name: string }).last_name}</p>
                {(primaryContact as { title: string | null }).title && (
                  <p className="text-xs text-muted-foreground">{(primaryContact as { title: string | null }).title}</p>
                )}
                <div className="flex flex-col gap-1 mt-2">
                  {(primaryContact as { email: string | null }).email && (
                    <a href={`mailto:${(primaryContact as { email: string | null }).email}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                      <Mail className="h-3 w-3" />{(primaryContact as { email: string | null }).email}
                    </a>
                  )}
                  {(primaryContact as { phone: string | null }).phone && (
                    <a href={`tel:${(primaryContact as { phone: string | null }).phone}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                      <Phone className="h-3 w-3" />{(primaryContact as { phone: string | null }).phone}
                    </a>
                  )}
                </div>
              </div>
            )}

            {enrichedActivities.length > 0 && (
              <div className="border rounded-lg p-4">
                <h3 className="text-sm font-semibold mb-3">Recent activity</h3>
                <div className="space-y-2">
                  {enrichedActivities.slice(0, 3).map((a: Record<string, unknown>) => (
                    <div key={a.id as string} className="text-sm">
                      <span className="font-medium">{a.subject as string}</span>
                      <span className="text-muted-foreground text-xs ml-2">{formatDistanceToNow(a.occurred_at as string)}</span>
                    </div>
                  ))}
                </div>
                {enrichedActivities.length > 3 && (
                  <Link href={`${basePath}?tab=activity`} className="text-xs text-muted-foreground hover:text-foreground mt-2 inline-flex items-center gap-1">
                    View all {enrichedActivities.length} activities <ExternalLink className="h-3 w-3" />
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Contacts + Branches combined tab */}
      {tab === "contacts" && (
        <BranchesContactsTab
          companyId={companyId}
          initialBranches={(branches ?? []) as Parameters<typeof BranchesContactsTab>[0]["initialBranches"]}
          initialContacts={(contacts ?? []) as unknown as Parameters<typeof BranchesContactsTab>[0]["initialContacts"]}
        />
      )}

      {/* Activity tab */}
      {tab === "activity" && (
        <ActivityTab
          companyId={companyId}
          initialActivities={enrichedActivities as Parameters<typeof ActivityTab>[0]["initialActivities"]}
          contacts={(contacts ?? []) as Parameters<typeof ActivityTab>[0]["contacts"]}
          currentUserName={user.full_name}
        />
      )}

      {/* Regulatory tab */}
      {tab === "regulatory" && (
        <div>
          {!(consultations?.length) ? (
            <div className="border rounded-lg text-center py-12 text-muted-foreground text-sm">No consultations for this company.</div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Consultation</th>
                    <th className="text-left px-4 py-3 font-medium">Reference</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-left px-4 py-3 font-medium">Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(consultations ?? []).map((c: Record<string, unknown>) => (
                    <tr key={c.id as string} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <Link href={`/regulatory/consultations/${c.id}`} className="font-medium hover:underline">{c.title as string}</Link>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{(c.reference_number as string) ?? "—"}</td>
                      <td className="px-4 py-3 capitalize text-muted-foreground">{String(c.status).replace(/_/g, " ")}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(c.due_date as string | null)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Recruitment tab */}
      {tab === "recruitment" && (
        <div>
          {!(jobs?.length) ? (
            <div className="border rounded-lg text-center py-12 text-muted-foreground text-sm">No jobs for this company.</div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Job</th>
                    <th className="text-left px-4 py-3 font-medium">Reference</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-left px-4 py-3 font-medium">Location</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(jobs ?? []).map((j: Record<string, unknown>) => (
                    <tr key={j.id as string} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <Link href={`/recruitment/jobs/${j.id}`} className="font-medium hover:underline">{j.title as string}</Link>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{(j.reference_number as string) ?? "—"}</td>
                      <td className="px-4 py-3 capitalize text-muted-foreground">{j.status as string}</td>
                      <td className="px-4 py-3 text-muted-foreground">{(j.location as string) ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Pipeline tab */}
      {tab === "pipeline" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              {(opportunities ?? []).length} opportunit{(opportunities ?? []).length !== 1 ? "ies" : "y"}
            </p>
            <NewOpportunityDialog
              companyId={companyId}
              companyName={company.name}
              contacts={(contacts ?? []) as { id: string; first_name: string; last_name: string }[]}
              profiles={typedProfiles}
            />
          </div>
          {!(opportunities?.length) ? (
            <div className="border rounded-lg text-center py-12 text-muted-foreground text-sm">
              No opportunities yet. Add one to start tracking this deal.
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Opportunity</th>
                    <th className="text-left px-4 py-3 font-medium">Stage</th>
                    <th className="text-left px-4 py-3 font-medium">Value</th>
                    <th className="text-left px-4 py-3 font-medium">Close date</th>
                    <th className="text-left px-4 py-3 font-medium">Module</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(opportunities ?? []).map((o: Record<string, unknown>) => (
                    <tr key={o.id as string} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{o.title as string}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={cn("text-xs capitalize", STAGE_STYLES[o.stage as string] ?? "")}>
                          {o.stage as string}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {o.value ? `${String(o.currency ?? "AUD")} ${Number(o.value).toLocaleString()}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(o.expected_close_date as string | null)}</td>
                      <td className="px-4 py-3 text-muted-foreground capitalize">{(o.module as string) ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
