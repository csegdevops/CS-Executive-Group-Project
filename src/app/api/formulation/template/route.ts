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

const INSTRUCTIONS = [
  ["Column", "Also accepted as", "Required?", "Notes"],
  [
    "INCI Name",
    "Chemical Name, Ingredient Name, Name, INCI",
    "Yes (or CAS)",
    "INCI or common chemical name of the ingredient",
  ],
  [
    "CAS Number",
    "CAS No, CAS#",
    "Recommended",
    "Most reliable identifier — include whenever possible",
  ],
  [
    "Alt CAS Number",
    "Alt CAS, Alternative CAS",
    "Optional",
    "Secondary CAS number if the ingredient has more than one",
  ],
  [
    "Concentration (%)",
    "Conc %, Conc, %, wt%, weight%, Amount %",
    "Optional",
    "Percentage by weight (e.g. 65.0)",
  ],
  [
    "Function",
    "Role, Use, Purpose",
    "Optional",
    "e.g. Solvent, Humectant, Preservative, Active",
  ],
  [
    "Product Name",
    "Product, Formulation",
    "Optional",
    "Groups ingredients by product when uploading multiple products at once",
  ],
]

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const ws = XLSX.utils.aoa_to_sheet([HEADERS, ...SAMPLE_ROWS])
  ws["!cols"] = [
    { wch: 30 },
    { wch: 16 },
    { wch: 18 },
    { wch: 18 },
    { wch: 16 },
    { wch: 22 },
  ]

  const wsInstructions = XLSX.utils.aoa_to_sheet(INSTRUCTIONS)
  wsInstructions["!cols"] = [
    { wch: 20 },
    { wch: 40 },
    { wch: 14 },
    { wch: 55 },
  ]

  const wb = XLSX.utils.book_new()
  // Formulation sheet MUST be first — the parser always reads SheetNames[0]
  XLSX.utils.book_append_sheet(wb, ws, "Formulation")
  XLSX.utils.book_append_sheet(wb, wsInstructions, "Instructions")

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })

  return new NextResponse(buf, {
    headers: {
      "Content-Type":        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="formulation-template.xlsx"',
      "Cache-Control":       "no-store",
    },
  })
}
