import { requireAuth } from "@/lib/auth-helpers"
import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/layout/PageHeader"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { AlertCircle } from "lucide-react"
import { ChemicalSearchInput } from "./ChemicalSearchInput"

interface SearchParams {
  q?: string
}

export default async function ChemicalsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  await requireAuth()
  const supabase = await createClient()
  const { q } = await searchParams
  const query = q?.trim() ?? ""

  let chemicals: {
    id: string
    cas_number: string | null
    common_name: string
    iupac_name: string | null
    molecular_formula: string | null
    needs_review: boolean
  }[] = []

  const reg = supabase.schema("regulatory")

  if (query.length >= 2) {
    const [directRes, aliasRes] = await Promise.all([
      reg
        .from("chemicals")
        .select("id, cas_number, common_name, iupac_name, molecular_formula, needs_review")
        .or(`common_name.ilike.%${query}%,cas_number.ilike.%${query}%,iupac_name.ilike.%${query}%`)
        .limit(30),
      reg
        .from("chemical_aliases")
        .select("chemical_id, chemicals(id, cas_number, common_name, iupac_name, molecular_formula, needs_review)")
        .ilike("alias", `%${query}%`)
        .limit(20),
    ])

    const direct = directRes.data ?? []
    const fromAliases = (aliasRes.data ?? [])
      .map((a) => a.chemicals)
      .filter(Boolean) as typeof direct

    const seen = new Set<string>()
    chemicals = [...direct, ...fromAliases].filter((c) => {
      if (seen.has(c.id)) return false
      seen.add(c.id)
      return true
    })
  } else {
    const { data } = await reg
      .from("chemicals")
      .select("id, cas_number, common_name, iupac_name, molecular_formula, needs_review")
      .order("created_at", { ascending: false })
      .limit(50)
    chemicals = data ?? []
  }

  return (
    <div>
      <PageHeader
        title="Chemical Catalogue"
        description="Search by CAS number, IUPAC name, or common/trade name"
      />

      <div className="mb-6 max-w-md">
        <ChemicalSearchInput defaultValue={query} />
      </div>

      {query.length > 0 && query.length < 2 && (
        <p className="text-sm text-muted-foreground mb-4">Enter at least 2 characters to search.</p>
      )}

      {chemicals.length === 0 && query.length >= 2 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="font-medium">No chemicals found for &quot;{query}&quot;</p>
          <p className="text-sm mt-1">Try a different CAS number or name.</p>
        </div>
      )}

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Chemical</th>
              <th className="text-left px-4 py-3 font-medium">CAS Number</th>
              <th className="text-left px-4 py-3 font-medium">Formula</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {chemicals.map((c) => (
              <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3">
                  <Link href={`/regulatory/chemicals/${c.id}`} className="font-medium hover:underline">
                    {c.common_name}
                  </Link>
                  {c.iupac_name && c.iupac_name !== c.common_name && (
                    <p className="text-xs text-muted-foreground truncate max-w-xs">{c.iupac_name}</p>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-xs">{c.cas_number ?? "—"}</td>
                <td className="px-4 py-3 font-mono text-xs">{c.molecular_formula ?? "—"}</td>
                <td className="px-4 py-3">
                  {c.needs_review ? (
                    <Badge variant="outline" className="text-xs gap-1 text-amber-700 border-amber-300 bg-amber-50">
                      <AlertCircle className="h-3 w-3" />
                      Needs review
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs text-green-700 border-green-300 bg-green-50">
                      Resolved
                    </Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {chemicals.length === 0 && query.length < 2 && (
          <div className="text-center py-10 text-muted-foreground text-sm">
            No chemicals in the catalogue yet. They are added automatically when you add them to consultations.
          </div>
        )}
      </div>
    </div>
  )
}
