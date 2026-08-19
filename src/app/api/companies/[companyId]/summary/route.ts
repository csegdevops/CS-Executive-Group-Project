import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requirePermissionOrSuperAdmin } from "@/lib/auth-helpers"
import { summarizer } from "@/lib/summarization"
import { buildCompanySummaryPrompt } from "@/lib/summarization/prompts"
import { isAiPaused, AI_PAUSED_MESSAGE } from "@/lib/ai/pause"

// POST /api/companies/[companyId]/summary
// Admin client + auth-only, matching GET /api/companies/[companyId] — any
// authenticated portal user can already view a company's full detail page
// and this route's underlying data via that GET, so generating a summary
// from the same data introduces no new exposure.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ companyId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await requirePermissionOrSuperAdmin(supabase, user.id, "ai.summaries.use"))) {
    return NextResponse.json({ error: "Forbidden — AI summaries permission required" }, { status: 403 })
  }

  if (await isAiPaused()) return NextResponse.json({ error: AI_PAUSED_MESSAGE }, { status: 503 })

  const { companyId } = await params
  const admin = createAdminClient()

  const [
    { data: company },
    { data: primaryContact },
    { count: branchCount },
    { data: recentActivities },
    { data: consultations },
    { data: jobs },
    { data: opportunities },
  ] = await Promise.all([
    admin.from("companies")
      .select("name, industry, country, abn, crm_status, notes, last_activity_at, account_owner_id")
      .eq("id", companyId).single(),
    admin.from("contacts")
      .select("first_name, last_name, title")
      .eq("company_id", companyId).eq("is_active", true).eq("is_primary", true).maybeSingle(),
    admin.from("company_branches")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId).eq("is_active", true),
    admin.from("company_activities")
      .select("subject, occurred_at")
      .eq("company_id", companyId).order("occurred_at", { ascending: false }).limit(5),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin.schema("regulatory") as any).from("consultations")
      .select("title, status, reference_number, due_date")
      .eq("company_id", companyId).order("created_at", { ascending: false }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin.schema("recruitment") as any).from("jobs")
      .select("title, status, location")
      .eq("company_id", companyId).order("created_at", { ascending: false }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin.schema("recruitment") as any).from("opportunities")
      .select("title, stage, value, currency")
      .eq("company_id", companyId).order("created_at", { ascending: false }),
  ])

  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 })

  let accountOwnerName: string | null = null
  if (company.account_owner_id) {
    const { data: owner } = await admin.from("profiles").select("full_name").eq("id", company.account_owner_id).single()
    accountOwnerName = owner?.full_name ?? null
  }

  const prompt = buildCompanySummaryPrompt({
    company,
    accountOwnerName,
    primaryContact: primaryContact ?? null,
    branchCount: branchCount ?? 0,
    recentActivities: recentActivities ?? [],
    consultations: (consultations ?? []) as Array<{ title: string; status: string; reference_number: string | null; due_date: string | null }>,
    jobs: (jobs ?? []) as Array<{ title: string; status: string; location: string | null }>,
    opportunities: (opportunities ?? []) as Array<{ title: string; stage: string; value: number | null; currency: string | null }>,
  })

  try {
    const summary = await summarizer.summarize(prompt)
    return NextResponse.json({ summary })
  } catch (err) {
    console.error("[companies/summary] gemini call failed", err)
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to generate summary" }, { status: 500 })
  }
}
