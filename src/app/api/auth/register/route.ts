import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"
import { z } from "zod"

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  full_name: z.string().min(1, "Full name is required"),
})

export async function POST(request: Request) {
  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid input"
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const { email, password, full_name } = parsed.data
  const domain = email.split("@")[1]?.toLowerCase()

  if (!domain) {
    return NextResponse.json({ error: "Invalid email address." }, { status: 400 })
  }

  const admin = createAdminClient()

  // Check domain is on the allow-list
  const { data: allowed } = await admin
    .from("allowed_email_domains")
    .select("domain")
    .eq("domain", domain)
    .single()

  if (!allowed) {
    return NextResponse.json(
      { error: "Your email domain is not authorised for this portal. Contact your administrator." },
      { status: 403 }
    )
  }

  // Create the user — email auto-confirmed (internal portal, no verification email needed)
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  })

  if (error) {
    if (error.message.toLowerCase().includes("already registered") || error.message.toLowerCase().includes("already exists")) {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
