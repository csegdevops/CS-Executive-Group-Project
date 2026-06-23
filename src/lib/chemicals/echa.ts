import type { RegulatoryStatus } from "@/types/database"

interface EchaResult {
  status: RegulatoryStatus
  listName: string | null
  listUrl: string | null
}

export async function fetchReachStatus(casNumber: string): Promise<EchaResult | null> {
  try {
    const encoded = encodeURIComponent(casNumber.trim())
    const res = await fetch(
      `https://chem.echa.europa.eu/api/substance/search?cas=${encoded}`,
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10000),
      }
    )

    if (!res.ok) return null

    const json = await res.json()
    const substances = json?.substances ?? json?.results ?? []

    if (!substances.length) {
      return { status: "not_listed", listName: "ECHA CHEM", listUrl: null }
    }

    // Check for SVHC / restricted status in substance data
    const substance = substances[0]
    const isRestricted = substance?.regulatoryProcesses?.some(
      (p: { type?: string }) => p.type === "RESTRICTION" || p.type === "AUTHORISATION"
    )

    return {
      status: isRestricted ? "restricted" : "listed",
      listName: "ECHA CHEM Database",
      listUrl: substance?.url ?? null,
    }
  } catch {
    return null
  }
}
