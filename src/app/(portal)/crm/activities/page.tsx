import { requireModuleAccess } from "@/lib/auth-helpers"
import { createAdminClient } from "@/lib/supabase/admin"
import { PageHeader } from "@/components/layout/PageHeader"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { formatDistanceToNow } from "@/lib/date-helpers"
import { Phone, Mail, Users, FileText } from "lucide-react"

interface EnrichedActivity {
  id: string
  activity_type: string
  subject: string
  body: string | null
  occurred_at: string
  company_id: string
  contact_id: string | null
  linked_module: string | null
  company_name: string
  performer_name: string | null
  contact_name: string | null
}

const TYPE_ICONS = { call: Phone, email: Mail, meeting: Users, note: FileText } as const
const TYPE_COLORS: Record<string, string> = {
  call:    "bg-green-100  text-green-700",
  email:   "bg-blue-100   text-blue-700",
  meeting: "bg-purple-100 text-purple-700",
  note:    "bg-amber-100  text-amber-700",
}

export default async function ActivitiesPage() {
  await requireModuleAccess("crm")
  const admin = createAdminClient()

  const { data: activities } = await admin
    .from("company_activities")
    .select("*")
    .order("occurred_at", { ascending: false })
    .limit(100)

  const companyIds  = [...new Set((activities ?? []).map((a: { company_id: string }) => a.company_id))] as string[]
  const perfIds     = [...new Set((activities ?? []).map((a: { performed_by: string }) => a.performed_by))] as string[]
  const contactIds  = [...new Set((activities ?? []).map((a: { contact_id: string | null }) => a.contact_id).filter(Boolean))] as string[]

  const [{ data: companies }, { data: profiles }, { data: contacts }] = await Promise.all([
    companyIds.length ? admin.from("companies").select("id, name").in("id", companyIds) : { data: [] },
    perfIds.length    ? admin.from("profiles").select("id, full_name").in("id", perfIds) : { data: [] },
    contactIds.length ? admin.from("contacts").select("id, first_name, last_name").in("id", contactIds) : { data: [] },
  ])

  const companyMap = Object.fromEntries((companies ?? []).map((c: { id: string; name: string }) => [c.id, c.name]))
  const profileMap = Object.fromEntries((profiles ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name]))
  const contactMap = Object.fromEntries((contacts ?? []).map((c: { id: string; first_name: string; last_name: string }) => [c.id, `${c.first_name} ${c.last_name}`]))

  type RawActivity = { id: string; activity_type: string; subject: string; body: string | null; occurred_at: string; company_id: string; contact_id: string | null; linked_module: string | null; performed_by: string }
  const enriched: EnrichedActivity[] = (activities ?? []).map((a: RawActivity) => ({
    id: a.id,
    activity_type: a.activity_type,
    subject: a.subject,
    body: a.body,
    occurred_at: a.occurred_at,
    company_id: a.company_id,
    contact_id: a.contact_id,
    linked_module: a.linked_module,
    company_name:   companyMap[a.company_id] ?? "Unknown",
    performer_name: profileMap[a.performed_by] ?? null,
    contact_name:   a.contact_id ? (contactMap[a.contact_id] ?? null) : null,
  }))

  return (
    <div>
      <PageHeader title="Activities" description="All client interactions across the business" />

      {enriched.length === 0 ? (
        <div className="border rounded-lg text-center py-16 text-muted-foreground text-sm">
          No activities logged yet. Go to a company and log a call, email, or meeting.
        </div>
      ) : (
        <div className="space-y-2">
          {enriched.map(a => {
            const Icon = TYPE_ICONS[a.activity_type as keyof typeof TYPE_ICONS] ?? FileText
            return (
              <div key={a.id} className="flex gap-3 border rounded-lg px-4 py-3">
                <div className={`mt-0.5 p-1.5 rounded-md shrink-0 ${TYPE_COLORS[a.activity_type] ?? ""}`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium text-sm">{a.subject}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{formatDistanceToNow(a.occurred_at)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                    <Link href={`/crm/accounts/${a.company_id}`} className="hover:text-foreground hover:underline font-medium">
                      {a.company_name}
                    </Link>
                    <span>·</span>
                    <span>{a.performer_name ?? "Unknown"}</span>
                    {a.contact_name && <><span>·</span><span>with {a.contact_name}</span></>}
                    {a.linked_module && (
                      <Badge variant="outline" className="text-xs capitalize">{a.linked_module}</Badge>
                    )}
                  </div>
                  {a.body && <p className="text-sm text-foreground/80 mt-1 line-clamp-2">{a.body}</p>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
