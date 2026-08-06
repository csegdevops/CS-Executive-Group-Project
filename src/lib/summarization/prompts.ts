// ─── Company summary ─────────────────────────────────────────────────────────

export interface CompanySummaryData {
  company: {
    name: string
    industry: string | null
    country: string | null
    abn: string | null
    crm_status: string
    notes: string | null
    last_activity_at: string | null
  }
  accountOwnerName: string | null
  primaryContact: { first_name: string; last_name: string; title: string | null } | null
  branchCount: number
  recentActivities: { subject: string; occurred_at: string }[]
  consultations: { title: string; status: string; reference_number: string | null; due_date: string | null }[]
  jobs: { title: string; status: string; location: string | null }[]
  opportunities: { title: string; stage: string; value: number | null; currency: string | null }[]
}

function block(label: string, lines: string[]): string {
  return lines.length === 0 ? "" : `${label}:\n${lines.map((l) => `- ${l}`).join("\n")}`
}

export function buildCompanySummaryPrompt(data: CompanySummaryData): string {
  const { company, accountOwnerName, primaryContact, branchCount, recentActivities, consultations, jobs, opportunities } = data

  const companyLines = [
    `Name: ${company.name}`,
    company.industry && `Industry: ${company.industry}`,
    company.country && `Country: ${company.country}`,
    company.abn && `ABN: ${company.abn}`,
    `CRM status: ${company.crm_status}`,
    `Branches: ${branchCount}`,
    accountOwnerName && `Account owner: ${accountOwnerName}`,
    company.last_activity_at && `Last activity: ${company.last_activity_at}`,
    company.notes && `Notes: ${company.notes}`,
  ].filter((l): l is string => Boolean(l))

  const sections = [
    `Company:\n${companyLines.map((l) => `- ${l}`).join("\n")}`,
    primaryContact && block("Primary contact", [
      `${primaryContact.first_name} ${primaryContact.last_name}${primaryContact.title ? ` (${primaryContact.title})` : ""}`,
    ]),
    block("Recent activity", recentActivities.map((a) => `${a.subject} — ${a.occurred_at}`)),
    block("Regulatory consultations", consultations.map((c) =>
      `${c.title}${c.reference_number ? ` (${c.reference_number})` : ""} — ${c.status}${c.due_date ? `, due ${c.due_date}` : ""}`
    )),
    block("Recruitment jobs", jobs.map((j) => `${j.title} — ${j.status}${j.location ? `, ${j.location}` : ""}`)),
    block("Pipeline opportunities", opportunities.map((o) =>
      `${o.title} — ${o.stage}${o.value ? `, ${o.currency ?? "AUD"} ${o.value.toLocaleString()}` : ""}`
    )),
  ].filter(Boolean)

  return `${sections.join("\n\n")}

Write a short plain-English overview paragraph (3-5 sentences, no markdown, no bullet points, no headers) of this company's relationship with our firm for someone unfamiliar with the account. Mention industry/location, CRM status, and any notable regulatory, recruitment, or pipeline activity — including anything that looks overdue or stalled. Only use the facts given above; do not invent details.`
}

// ─── Consultation summary ────────────────────────────────────────────────────

interface RawConsultationChemical {
  chemical_id: string | null
  chemicals: {
    common_name: string
    regulatory_listings: { framework: string; status: string; list_name: string | null }[]
  } | null
}

interface RawProduct {
  product_name: string
  units_per_year: number | null
  unit_size_grams: number | null
}

// Mirrors the checklist math in consultations/[consultationId]/page.tsx so the
// summary paragraph never disagrees with what the Timeline tab already shows.
function computeProgressSummaries(
  status: string,
  consultationChemicals: RawConsultationChemical[],
  products: RawProduct[]
) {
  const resolvedCount   = consultationChemicals.filter((cc) => cc.chemical_id !== null).length
  const unresolvedCount = consultationChemicals.filter((cc) => cc.chemical_id === null).length
  const chemicalsSummary =
    consultationChemicals.length === 0 ? "No chemicals added yet"
    : unresolvedCount > 0 ? `${resolvedCount} resolved, ${unresolvedCount} need${unresolvedCount === 1 ? "s" : ""} review`
    : `${resolvedCount} chemical${resolvedCount !== 1 ? "s" : ""}`

  const totalProducts       = products.length
  const productsWithVolumes = products.filter((p) => p.units_per_year != null).length
  const volumesSummary =
    totalProducts === 0 ? "No products added"
    : productsWithVolumes === totalProducts ? `${totalProducts} product${totalProducts !== 1 ? "s" : ""} complete`
    : `${productsWithVolumes} of ${totalProducts} product${totalProducts !== 1 ? "s" : ""} with volumes`

  const assessedCount = consultationChemicals.filter(
    (cc) => cc.chemicals && cc.chemicals.regulatory_listings.length > 0
  ).length
  const restrictedCount = consultationChemicals.filter(
    (cc) => cc.chemicals && cc.chemicals.regulatory_listings.some((rl) => rl.status === "restricted")
  ).length
  const regulatorySummary =
    assessedCount === 0 ? "Not yet assessed"
    : restrictedCount > 0 ? `${assessedCount} assessed, ${restrictedCount} restricted`
    : `${assessedCount} chemical${assessedCount !== 1 ? "s" : ""} assessed`

  const sentForReview = ["under_review", "completed"].includes(status)

  return { chemicalsSummary, volumesSummary, regulatorySummary, sentForReview }
}

export interface ConsultationSummaryData {
  consultation: {
    title: string
    description: string | null
    status: string
    due_date: string | null
    frameworks: string[]
    reference_number: string | null
  }
  companyName: string | null
  consultants: string[]
  consultationChemicals: RawConsultationChemical[]
  products: RawProduct[]
}

export function buildConsultationSummaryPrompt(data: ConsultationSummaryData): string {
  const { consultation, companyName, consultants, consultationChemicals, products } = data
  const { chemicalsSummary, volumesSummary, regulatorySummary, sentForReview } =
    computeProgressSummaries(consultation.status, consultationChemicals, products)

  const restrictedChemicals = consultationChemicals.flatMap((cc) =>
    (cc.chemicals?.regulatory_listings ?? [])
      .filter((rl) => rl.status === "restricted")
      .map((rl) => ({ name: cc.chemicals!.common_name, framework: rl.framework, listName: rl.list_name }))
  )

  const consultationLines = [
    `Title: ${consultation.title}`,
    consultation.reference_number && `Reference: ${consultation.reference_number}`,
    `Status: ${consultation.status}${sentForReview ? " (sent for review)" : ""}`,
    consultation.due_date && `Due date: ${consultation.due_date}`,
    `Frameworks: ${consultation.frameworks.join(", ") || "none specified"}`,
    consultation.description && `Description: ${consultation.description}`,
  ].filter((l): l is string => Boolean(l))

  const sections = [
    `Consultation:\n${consultationLines.map((l) => `- ${l}`).join("\n")}`,
    companyName && block("Company", [companyName]),
    block("Assigned consultants", consultants),
    block("Progress", [
      `Chemicals: ${chemicalsSummary}`,
      `Volumes: ${volumesSummary}`,
      `Regulatory assessment: ${regulatorySummary}`,
    ]),
    block("Restricted chemicals", restrictedChemicals.map((rc) =>
      `${rc.name} — restricted under ${rc.framework.toUpperCase()}${rc.listName ? ` (${rc.listName})` : ""}`
    )),
    block("Products", products.map((p) =>
      `${p.product_name}${p.units_per_year != null ? ` — ${p.units_per_year} units/year` : ""}${p.unit_size_grams != null ? `, ${p.unit_size_grams}g/unit` : ""}`
    )),
  ].filter(Boolean)

  return `${sections.join("\n\n")}

Write a short plain-English overview paragraph (3-5 sentences, no markdown, no bullet points, no headers) of this regulatory consultation for a colleague who hasn't looked at it yet. Cover the client and frameworks involved, current progress, and flag any chemical that is restricted under any framework. Only use the facts given above; do not invent details.`
}
