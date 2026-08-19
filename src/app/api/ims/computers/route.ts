import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requirePermissionOrSuperAdmin } from "@/lib/auth-helpers"
import { NextResponse } from "next/server"
import { z } from "zod"

const ASSET_TAG_PREFIX = "CSEG-CL"

// Numbers aren't zero-padded (CSEG-CL9, CSEG-CL10, ...), so the max has to be
// found by parsing every existing tag numerically rather than an ORDER BY on
// the text column — lexicographic order would put "CSEG-CL19" before
// "CSEG-CL2" and pick the wrong "last" tag.
async function nextAssetTag(admin: ReturnType<typeof createAdminClient>): Promise<string> {
  const { data } = await admin
    .schema("ims")
    .from("computers")
    .select("asset_tag")
    .like("asset_tag", `${ASSET_TAG_PREFIX}%`)

  const maxN = (data ?? []).reduce((max, row) => {
    const match = row.asset_tag?.match(new RegExp(`^${ASSET_TAG_PREFIX}(\\d+)$`))
    if (!match) return max
    const n = parseInt(match[1], 10)
    return n > max ? n : max
  }, 0)

  return `${ASSET_TAG_PREFIX}${maxN + 1}`
}

const createSchema = z.object({
  hostname:        z.string().min(1),
  asset_tag:       z.string().optional(),
  device_type:     z.enum(["laptop", "desktop", "server", "printer", "network_device", "mobile", "other"]).optional(),
  make:            z.string().optional(),
  model:           z.string().optional(),
  serial_number:   z.string().optional(),
  service_tag:     z.string().optional(),
  assigned_to:     z.string().uuid().optional(),
  location:        z.enum(["Melbourne Office", "Sydney", "Brisbane", "Canberra"]).optional(),
  status:          z.enum(["in_use", "spare", "in_repair", "retired"]).optional(),
  purchase_date:   z.string().optional(),
  warranty_expiry: z.string().optional(),
  notes:           z.string().optional(),
}).refine(
  (v) => !["in_use", "in_repair"].includes(v.status ?? "in_use") || !!v.assigned_to,
  { message: "assigned_to is required while status is in_use or in_repair", path: ["assigned_to"] }
)

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data, error } = await supabase
    .schema("ims")
    .from("computers")
    .select("*")
    .order("hostname")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const assignedIds = [...new Set((data ?? []).map((c) => c.assigned_to).filter(Boolean))] as string[]
  const { data: profiles } = assignedIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", assignedIds)
    : { data: [] }
  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.full_name]))

  return NextResponse.json(
    (data ?? []).map((c) => ({ ...c, assigned_to_name: c.assigned_to ? profileMap[c.assigned_to] ?? null : null }))
  )
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!(await requirePermissionOrSuperAdmin(supabase, user.id, "ims.computers.manage"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await request.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const admin = createAdminClient()
  const assetTag = parsed.data.asset_tag || await nextAssetTag(admin)

  const { data, error } = await admin
    .schema("ims")
    .from("computers")
    .insert({ ...parsed.data, asset_tag: assetTag, created_by: user.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
