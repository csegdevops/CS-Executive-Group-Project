import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import * as XLSX from "xlsx"

const HEADERS = ["INCI Name", "CAS Number", "Alt CAS Number", "Concentration (%)", "Function", "Product Name"]

const SAMPLE_ROWS = [
  ["Water", "7732-18-5", "", "65.0", "Solvent", "Moisturising Cream"],
  ["Glycerin", "56-81-5", "", "10.0", "Humectant", "Moisturising Cream"],
  ["Niacinamide", "98-92-0", "", "5.0", "Active", "Moisturising Cream"],
  ["Cetearyl Alcohol", "67762-27-0", "8005-44-5", "3.0", "Emulsifier", "Moisturising Cream"],
]

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const ws = XLSX.utils.aoa_to_sheet([HEADERS, ...SAMPLE_ROWS])

  // Set column widths
  ws["!cols"] = [
    { wch: 30 },
    { wch: 16 },
    { wch: 18 },
    { wch: 18 },
    { wch: 16 },
    { wch: 22 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Formulation")

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })

  return new NextResponse(buf, {
    headers: {
      "Content-Type":        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="formulation-template.xlsx"',
      "Cache-Control":       "no-store",
    },
  })
}
