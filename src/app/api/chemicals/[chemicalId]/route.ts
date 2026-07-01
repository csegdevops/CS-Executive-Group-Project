import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ chemicalId: string }> }
) {
  const { chemicalId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const admin = createAdminClient()
  const reg = admin.schema("regulatory")

  const { data: chemical } = await reg
    .from("chemicals")
    .select("id, source, common_name")
    .eq("id", chemicalId)
    .single()

  if (!chemical) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (chemical.source !== "chemskill") {
    return NextResponse.json(
      { error: "Only manually added (Chemskill) chemicals can be deleted from the global database." },
      { status: 403 }
    )
  }

  // Unlink consultation_chemicals rows before deleting (FK constraint)
  await reg
    .from("consultation_chemicals")
    .update({ chemical_id: null })
    .eq("chemical_id", chemicalId)

  const { error } = await reg.from("chemicals").delete().eq("id", chemicalId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return new NextResponse(null, { status: 204 })
}
