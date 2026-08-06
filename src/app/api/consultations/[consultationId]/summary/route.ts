import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { summarizer } from "@/lib/summarization"
import { buildConsultationSummaryPrompt, type ConsultationSummaryData } from "@/lib/summarization/prompts"
import { isAiPaused, AI_PAUSED_MESSAGE } from "@/lib/ai/pause"

// POST /api/consultations/[consultationId]/summary
export async function POST(_req: NextRequest, { params }: { params: Promise<{ consultationId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { consultationId } = await params

  if (await isAiPaused()) return NextResponse.json({ error: AI_PAUSED_MESSAGE }, { status: 503 })

  // RLS (consultations_select policy) scopes this to module admins and
  // assigned consultants, same access model as the consultation detail page
  // — a row the caller can't see comes back null from .single(), treated as 404.
  const { data: consultation } = await supabase
    .schema("regulatory")
    .from("consultations")
    .select(`
      title, description, status, due_date, frameworks, reference_number, company_id,
      consultation_chemicals(
        chemical_id,
        chemicals(common_name, regulatory_listings(framework, status, list_name))
      )
    `)
    .eq("id", consultationId)
    .single()

  if (!consultation) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const [{ data: company }, { data: products }] = await Promise.all([
    supabase.from("companies").select("name").eq("id", consultation.company_id).single(),
    supabase.schema("regulatory").from("consultation_products")
      .select("product_name, units_per_year, unit_size_grams")
      .eq("consultation_id", consultationId),
  ])

  // consultation_consultants is not exposed to the RLS-scoped client — same
  // reason the detail page reads it through the admin client.
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: ccRows } = await (admin.schema("regulatory") as any)
    .from("consultation_consultants")
    .select("consultant_id")
    .eq("consultation_id", consultationId)
  const consultantIds = ((ccRows ?? []) as Array<{ consultant_id: string }>).map((r) => r.consultant_id)
  const { data: consultantProfiles } = consultantIds.length > 0
    ? await admin.from("profiles").select("full_name").in("id", consultantIds)
    : { data: [] }

  const prompt = buildConsultationSummaryPrompt({
    consultation: {
      title: consultation.title,
      description: consultation.description,
      status: consultation.status,
      due_date: consultation.due_date,
      frameworks: (consultation.frameworks ?? []) as string[],
      reference_number: consultation.reference_number,
    },
    companyName: company?.name ?? null,
    consultants: (consultantProfiles ?? []).map((p) => p.full_name).filter((n): n is string => Boolean(n)),
    consultationChemicals: (consultation.consultation_chemicals ?? []) as ConsultationSummaryData["consultationChemicals"],
    products: (products ?? []) as Array<{ product_name: string; units_per_year: number | null; unit_size_grams: number | null }>,
  })

  try {
    const summary = await summarizer.summarize(prompt)
    return NextResponse.json({ summary })
  } catch (err) {
    console.error("[consultations/summary] gemini call failed", err)
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to generate summary" }, { status: 500 })
  }
}
