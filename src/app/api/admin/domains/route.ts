import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"
import { z } from "zod"

async function requireSuperAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role !== "super_admin") return null
  return user
}

export async function GET() {
  const supabase = await createClient()
  const caller = await requireSuperAdmin(supabase)
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { data, error } = await supabase
    .from("allowed_email_domains")
    .select("id, domain, added_at")
    .order("domain")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

const addSchema = z.object({
  domain: z
    .string()
    .min(3)
    .regex(/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, "Enter a valid domain (e.g. company.com)"),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const caller = await requireSuperAdmin(supabase)
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await request.json()
  const parsed = addSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid domain" }, { status: 400 })
  }

  const domain = parsed.data.domain.toLowerCase()
  const admin = createAdminClient()

  const { error } = await admin
    .from("allowed_email_domains")
    .insert({ domain, added_by: caller.id })

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "This domain is already on the list." }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
