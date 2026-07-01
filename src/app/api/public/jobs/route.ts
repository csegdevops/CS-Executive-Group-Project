import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * PUBLIC endpoint — no authentication required.
 * Exposes active job listings for WordPress/website consumption.
 *
 * WordPress integration:
 *   - Install WP Job Manager or use a custom REST endpoint on the WP side
 *   - Fetch this endpoint via WP cron (hourly) and sync to WP Job posts
 *   - Or: use a WordPress plugin like "WP REST API Cache" + "Auto Post Scheduler"
 *     to pull from this URL into WP job listings automatically
 *
 * Schema.org format (?format=schema) is ready for Google for Jobs rich results.
 *
 * Usage:
 *   GET /api/public/jobs                     → all active jobs (JSON)
 *   GET /api/public/jobs?format=schema       → Schema.org JobPosting array
 *   GET /api/public/jobs?clearance=true      → clearance required only
 *   GET /api/public/jobs?type=permanent      → filter by employment_type
 *   GET /api/public/jobs?company=ABC         → filter by company name substring
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const format    = searchParams.get("format")
  const clearance = searchParams.get("clearance") === "true"
  const empType   = searchParams.get("type")
  const company   = searchParams.get("company")

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (admin.schema("recruitment") as any)
    .from("jobs")
    .select(`
      id, title, reference_number, description, requirements,
      employment_type, location, salary_min, salary_max, salary_currency,
      security_clearance_required, status, company_id, created_at, updated_at
    `)
    .in("status", ["posted", "active"])
    .order("created_at", { ascending: false })

  if (clearance) query = query.eq("security_clearance_required", true)
  if (empType)   query = query.eq("employment_type", empType)

  const { data: jobs, error } = await query
  if (error) return NextResponse.json({ error: "Internal error" }, { status: 500, headers: CORS_HEADERS })

  // Hydrate company names
  const companyIds = [...new Set((jobs ?? []).map((j: { company_id: string }) => j.company_id))] as string[]
  const { data: companies } = companyIds.length
    ? await admin.from("companies").select("id, name").in("id", companyIds)
    : { data: [] }
  const companyMap = Object.fromEntries((companies ?? []).map((c: { id: string; name: string }) => [c.id, c.name]))

  let filtered = (jobs ?? []).map((j: Record<string, unknown>) => ({
    ...j,
    company_name: companyMap[j.company_id as string] ?? "CS Executive Group",
  }))

  if (company) {
    filtered = filtered.filter((j: { company_name: string }) =>
      j.company_name.toLowerCase().includes(company.toLowerCase())
    )
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://portal.csexecutivegroup.com.au"
  const publicApplyUrl = `${baseUrl}/api/public/apply`

  if (format === "schema") {
    // Schema.org JobPosting for Google for Jobs + WordPress SEO plugins
    const schemaJobs = filtered.map((j: Record<string, unknown>) => ({
      "@context": "https://schema.org",
      "@type": "JobPosting",
      "title": j.title,
      "identifier": {
        "@type": "PropertyValue",
        "name": "CS Executive Group",
        "value": j.reference_number ?? j.id,
      },
      "description": j.description ?? "",
      "datePosted": j.created_at,
      "validThrough": null,
      "employmentType": j.employment_type === "permanent" ? "FULL_TIME"
        : j.employment_type === "contract" ? "CONTRACTOR" : "PART_TIME",
      "hiringOrganization": {
        "@type": "Organization",
        "name": "CS Executive Group",
        "sameAs": "https://www.csexecutivegroup.com.au",
      },
      "jobLocation": {
        "@type": "Place",
        "address": {
          "@type": "PostalAddress",
          "addressLocality": j.location ?? "Australia",
          "addressCountry": "AU",
        },
      },
      "baseSalary": j.salary_min ? {
        "@type": "MonetaryAmount",
        "currency": j.salary_currency ?? "AUD",
        "value": {
          "@type": "QuantitativeValue",
          "minValue": j.salary_min,
          "maxValue": j.salary_max ?? j.salary_min,
          "unitText": "YEAR",
        },
      } : undefined,
      "securityClearanceRequired": j.security_clearance_required,
      "hirerReference": j.reference_number,
      "applyAction": {
        "@type": "ApplyAction",
        "target": `${publicApplyUrl}?ref=${j.reference_number ?? j.id}`,
      },
    }))
    return NextResponse.json(schemaJobs, { headers: CORS_HEADERS })
  }

  // Standard JSON response for WordPress REST API
  const result = filtered.map((j: Record<string, unknown>) => ({
    id:                          j.id,
    reference_number:            j.reference_number,
    title:                       j.title,
    company_name:                j.company_name,
    location:                    j.location,
    employment_type:             j.employment_type,
    salary_min:                  j.salary_min,
    salary_max:                  j.salary_max,
    salary_currency:             j.salary_currency,
    security_clearance_required: j.security_clearance_required,
    description:                 j.description,
    requirements:                j.requirements,
    status:                      j.status,
    posted_at:                   j.created_at,
    apply_url:                   `${publicApplyUrl}?ref=${j.reference_number ?? j.id}`,
    portal_url:                  `${baseUrl}/careers/${j.reference_number ?? j.id}`,
  }))

  return NextResponse.json({ jobs: result, count: result.length, fetched_at: new Date().toISOString() }, { headers: CORS_HEADERS })
}
