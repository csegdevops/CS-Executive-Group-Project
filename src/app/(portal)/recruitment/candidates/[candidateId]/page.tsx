import { requireModuleAccess } from "@/lib/auth-helpers"
import { createAdminClient } from "@/lib/supabase/admin"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { CandidateSkillsEditor } from "./CandidateSkillsEditor"
import { CandidateEducationTagsEditor } from "./CandidateEducationTagsEditor"
import { EditCandidateDialog } from "./EditCandidateDialog"
import { CvUploadButton } from "./CvUploadButton"
import { DeleteCvButton } from "./DeleteCvButton"
import { CvParseStatusControl } from "./CvParseStatusControl"
import { AddToJobDialog } from "./AddToJobDialog"
import { ChevronLeft, Mail, Phone, MapPin, Shield, FileText, GraduationCap, Briefcase } from "lucide-react"
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

  const [{ data: candidate }, { data: applications }, { data: lookups }] = await Promise.all([
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
    admin
      .from("lookup_values")
      .select("category, value, label")
      .in("category", ["security_clearance_level", "citizenship_status"]),
  ])

  if (!candidate) notFound()

  const lookupLabel = (category: string, value: string | null) =>
    (lookups ?? []).find((l: { category: string; value: string }) => l.category === category && l.value === value)?.label
      ?? value ?? ""

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

  const parsedMetadata = candidate.parsed_metadata as {
    education?: { institution: string; degree: string | null; field_of_study: string | null; start_date: string | null; end_date: string | null }[]
    work_experience?: { employer: string; title: string; start_date: string | null; end_date: string | null; description: string | null }[]
  } | null

  const dateRange = (start: string | null, end: string | null) =>
    [start, end].filter(Boolean).join(" – ") || null

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
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-semibold">{candidate.first_name} {candidate.last_name}</h1>
                  <EditCandidateDialog
                    candidateId={candidate.id}
                    initial={{
                      first_name: candidate.first_name ?? "",
                      last_name: candidate.last_name ?? "",
                      email: candidate.email ?? "",
                      secondary_email: candidate.secondary_email ?? "",
                      phone: candidate.phone ?? "",
                      current_title: candidate.current_title ?? "",
                      current_employer: candidate.current_employer ?? "",
                      employment_status: candidate.employment_status ?? "employed",
                      location_city: candidate.location_city ?? "",
                      location_state: candidate.location_state ?? "",
                      location_postcode: candidate.location_postcode ?? "",
                      field_of_study: candidate.field_of_study ?? "",
                      citizenship_status: candidate.citizenship_status ?? "",
                      security_clearance_level: candidate.security_clearance_level ?? "",
                      security_clearance_verified: candidate.security_clearance_verified ?? false,
                      security_clearance_expiry: candidate.security_clearance_expiry ?? "",
                    }}
                  />
                  {candidate.employment_status === "not_working" && (
                    <Badge variant="outline" className="text-xs text-muted-foreground">Not currently working</Badge>
                  )}
                </div>
                {candidate.current_title && (
                  <p className="text-sm text-muted-foreground">
                    {candidate.employment_status === "not_working" ? "Last: " : ""}{candidate.current_title}
                  </p>
                )}
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
              {candidate.secondary_email && (
                <a href={`mailto:${candidate.secondary_email}`} className="flex items-center gap-2 text-sm hover:text-primary transition-colors">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />{candidate.secondary_email}
                  <span className="text-xs text-muted-foreground">(secondary)</span>
                </a>
              )}
              {candidate.phone && (
                <a href={`tel:${candidate.phone}`} className="flex items-center gap-2 text-sm hover:text-primary transition-colors">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />{candidate.phone}
                </a>
              )}
              {(candidate.location_city || candidate.location_state) && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  {[candidate.location_city, candidate.location_state, candidate.location_postcode, candidate.location_country].filter(Boolean).join(", ")}
                </p>
              )}
              {candidate.field_of_study && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <GraduationCap className="h-3.5 w-3.5" />{candidate.field_of_study}
                </p>
              )}
              {candidate.citizenship_status && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Shield className="h-3.5 w-3.5" />{lookupLabel("citizenship_status", candidate.citizenship_status)}
                </p>
              )}
            </div>

            <div className="mt-4 border-t pt-4">
              <CandidateSkillsEditor
                candidateId={candidate.id}
                initialTags={candidate.skills_tags ?? []}
              />
            </div>

            <div className="mt-4 border-t pt-4">
              <CandidateEducationTagsEditor
                candidateId={candidate.id}
                initialTags={candidate.education_tags ?? []}
              />
            </div>
          </div>

          {/* Security clearance */}
          {candidate.security_clearance_level && candidate.security_clearance_level !== "none" && (
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2 mb-1">
                <Shield className="h-4 w-4 text-amber-500" />
                <h3 className="font-medium text-sm">Security Clearance</h3>
              </div>
              <p className="text-sm">{lookupLabel("security_clearance_level", candidate.security_clearance_level)}</p>
              {candidate.security_clearance_verified && <Badge variant="outline" className="text-xs mt-1 text-green-700 border-green-200">Verified</Badge>}
              {candidate.security_clearance_expiry && (
                <p className="text-xs text-muted-foreground mt-1">
                  Expires: {new Date(candidate.security_clearance_expiry).toLocaleDateString("en-AU")}
                </p>
              )}
            </div>
          )}

          {/* Documents */}
          <div className="rounded-lg border bg-card p-4">
            <h3 className="font-medium text-sm mb-2">Documents</h3>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <div className="flex items-center gap-1.5">
                {candidate.cv_storage_key ? (
                  <a href={`/api/recruitment/candidates/${candidate.id}/cv?type=cv`} className="flex items-center gap-1.5 text-primary hover:underline">
                    <FileText className="h-3.5 w-3.5" />{candidate.cv_original_name ?? "Download CV"}
                  </a>
                ) : (
                  <span className="text-muted-foreground text-xs">No CV on file</span>
                )}
                <CvUploadButton candidateId={candidate.id} docType="cv" />
                {candidate.cv_storage_key && <DeleteCvButton candidateId={candidate.id} docType="cv" />}
                {candidate.cv_storage_key && (
                  <CvParseStatusControl candidateId={candidate.id} status={candidate.cv_parse_status ?? "unparsed"} />
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {candidate.cl_storage_key ? (
                  <a href={`/api/recruitment/candidates/${candidate.id}/cv?type=cl`} className="flex items-center gap-1.5 text-primary hover:underline">
                    <FileText className="h-3.5 w-3.5" />{candidate.cl_original_name ?? "Download Cover Letter"}
                  </a>
                ) : (
                  <span className="text-muted-foreground text-xs">No cover letter on file</span>
                )}
                <CvUploadButton candidateId={candidate.id} docType="cl" />
                {candidate.cl_storage_key && <DeleteCvButton candidateId={candidate.id} docType="cl" />}
              </div>
            </div>
          </div>

          {/* Work experience (parsed from CV) */}
          {parsedMetadata?.work_experience && parsedMetadata.work_experience.length > 0 && (
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-medium text-sm">Work Experience</h3>
                <Badge variant="outline" className="text-xs">from CV</Badge>
              </div>
              <div className="space-y-3">
                {parsedMetadata.work_experience.map((w, i) => (
                  <div key={i} className="text-sm">
                    <p className="font-medium">{w.title}</p>
                    <p className="text-muted-foreground">
                      {w.employer}
                      {dateRange(w.start_date, w.end_date) && ` · ${dateRange(w.start_date, w.end_date)}`}
                    </p>
                    {w.description && <p className="text-xs text-muted-foreground mt-0.5">{w.description}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Education (parsed from CV) */}
          {parsedMetadata?.education && parsedMetadata.education.length > 0 && (
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <GraduationCap className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-medium text-sm">Education</h3>
                <Badge variant="outline" className="text-xs">from CV</Badge>
              </div>
              <div className="space-y-3">
                {parsedMetadata.education.map((e, i) => (
                  <div key={i} className="text-sm">
                    <p className="font-medium">{e.institution}</p>
                    <p className="text-muted-foreground">
                      {[e.degree, e.field_of_study].filter(Boolean).join(", ")}
                      {dateRange(e.start_date, e.end_date) && ` · ${dateRange(e.start_date, e.end_date)}`}
                    </p>
                  </div>
                ))}
              </div>
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
