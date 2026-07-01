import { requireModuleAccess } from "@/lib/auth-helpers"
import { createAdminClient } from "@/lib/supabase/admin"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { CandidateSkillsEditor } from "./CandidateSkillsEditor"
import { AddToJobDialog } from "./AddToJobDialog"
import { ChevronLeft, Mail, Phone, MapPin, Shield, FileText, GraduationCap } from "lucide-react"
import { cn } from "@/lib/utils"

const STAGE_LABELS: Record<string, string> = {
  applied: "Applied", screening: "Screening", shortlisted: "Shortlisted",
  interview_1: "Interview 1", interview_2: "Interview 2",
  reference_check: "Ref Check", offer: "Offer", placed: "Placed",
  withdrawn: "Withdrawn", rejected: "Rejected",
}

const SOURCE_LABELS: Record<string, string> = {
  seek_inbound: "Seek [S]", company_website: "Website [CS]",
  database_internal: "Internal [DB]", seek_talent: "Seek Talent [ST]", linkedin: "LinkedIn [LI]",
}

export default async function CandidateProfilePage({ params }: { params: Promise<{ candidateId: string }> }) {
  await requireModuleAccess("recruitment")
  const { candidateId } = await params
  const admin = createAdminClient()

  const [{ data: candidate }, { data: applications }] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin.schema("recruitment") as any)
      .from("candidates")
      .select("*")
      .eq("id", candidateId)
      .single(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin.schema("recruitment") as any)
      .from("applications")
      .select("id, job_id, stage, source_channel, created_at, cv_storage_key, cv_original_name")
      .eq("candidate_id", candidateId)
      .order("created_at", { ascending: false }),
  ])

  if (!candidate) notFound()

  const jobIds = [...new Set((applications ?? []).map((a: { job_id: string }) => a.job_id))]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: jobs } = jobIds.length
    ? await (admin.schema("recruitment") as any)
        .from("jobs")
        .select("id, title, reference_number, company_id, status")
        .in("id", jobIds)
    : { data: [] }

  const companyIds = [...new Set((jobs ?? []).map((j: { company_id: string }) => j.company_id))] as string[]
  const { data: companies } = companyIds.length
    ? await admin.from("companies").select("id, name").in("id", companyIds)
    : { data: [] }

  const jobMap     = Object.fromEntries((jobs ?? []).map((j: Record<string, unknown>) => [j.id, j]))
  const companyMap = Object.fromEntries((companies ?? []).map((c: { id: string; name: string }) => [c.id, c.name]))

  const pct = candidate.profile_completeness_pct ?? 0

  return (
    <div className="max-w-3xl">
      <Link href="/recruitment/candidates" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ChevronLeft className="h-3.5 w-3.5" />All Candidates
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Left: profile */}
        <div className="md:col-span-2 space-y-4">
          {/* Header card */}
          <div className="rounded-lg border bg-card p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h1 className="text-xl font-semibold">{candidate.first_name} {candidate.last_name}</h1>
                {candidate.current_title && <p className="text-sm text-muted-foreground">{candidate.current_title}</p>}
                {candidate.current_employer && <p className="text-sm text-muted-foreground">{candidate.current_employer}</p>}
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground mb-1">Profile completeness</p>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-20 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full", pct >= 75 ? "bg-green-500" : pct >= 40 ? "bg-amber-500" : "bg-red-400")}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium">{pct}%</span>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <a href={`mailto:${candidate.email}`} className="flex items-center gap-2 text-sm hover:text-primary transition-colors">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />{candidate.email}
              </a>
              {candidate.phone && (
                <a href={`tel:${candidate.phone}`} className="flex items-center gap-2 text-sm hover:text-primary transition-colors">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />{candidate.phone}
                </a>
              )}
              {(candidate.location_city || candidate.location_state) && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  {[candidate.location_city, candidate.location_state, candidate.location_country].filter(Boolean).join(", ")}
                </p>
              )}
              {candidate.field_of_study && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <GraduationCap className="h-3.5 w-3.5" />{candidate.field_of_study}
                </p>
              )}
            </div>

            <div className="mt-4 border-t pt-4">
              <CandidateSkillsEditor
                candidateId={candidate.id}
                initialTags={candidate.skills_tags ?? []}
              />
            </div>
          </div>

          {/* Security clearance */}
          {candidate.security_clearance_level && (
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2 mb-1">
                <Shield className="h-4 w-4 text-amber-500" />
                <h3 className="font-medium text-sm">Security Clearance</h3>
              </div>
              <p className="text-sm">{candidate.security_clearance_level}</p>
              {candidate.security_clearance_verified && <Badge variant="outline" className="text-xs mt-1 text-green-700 border-green-200">Verified</Badge>}
              {candidate.security_clearance_expiry && (
                <p className="text-xs text-muted-foreground mt-1">
                  Expires: {new Date(candidate.security_clearance_expiry).toLocaleDateString("en-AU")}
                </p>
              )}
            </div>
          )}

          {/* Raw resume text (if parsed) */}
          {candidate.raw_resume_text && (
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-medium text-sm">Resume extract</h3>
                {candidate.cv_parsed_by && (
                  <Badge variant="outline" className="text-xs">{candidate.cv_parsed_by}</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-10">
                {candidate.raw_resume_text}
              </p>
            </div>
          )}
        </div>

        {/* Right: meta + applications */}
        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-4 space-y-2 text-sm">
            <h3 className="font-medium text-sm mb-2">Details</h3>
            <div>
              <p className="text-xs text-muted-foreground">Source</p>
              <p>{candidate.source_channel ? (SOURCE_LABELS[candidate.source_channel] ?? candidate.source_channel) : "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">CV status</p>
              <p className="capitalize">{candidate.cv_parse_status ?? "unparsed"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Added</p>
              <p>{new Date(candidate.created_at).toLocaleDateString("en-AU")}</p>
            </div>
          </div>

          {/* Applications */}
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-sm">Applications ({(applications ?? []).length})</h3>
              <AddToJobDialog candidateId={candidate.id} />
            </div>
            {(applications ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No applications yet.</p>
            ) : (
              <div className="space-y-2">
                {(applications ?? []).map((a: Record<string, unknown>) => {
                  const job = jobMap[a.job_id as string] as Record<string, unknown> | undefined
                  return (
                    <Link
                      key={a.id as string}
                      href={`/recruitment/applications/${a.id}`}
                      className="block rounded-md border p-2.5 hover:bg-muted/30 transition-colors"
                    >
                      <p className="text-sm font-medium">{(job?.title as string | undefined) ?? "Unknown"}</p>
                      {job && companyMap[job.company_id as string] && (
                        <p className="text-xs text-muted-foreground">{companyMap[job.company_id as string]}</p>
                      )}
                      <p className="text-xs text-muted-foreground capitalize mt-0.5">
                        {STAGE_LABELS[a.stage as string] ?? a.stage as string}
                      </p>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
