import type { PubChemResult } from "./types"

const BASE = "https://pubchem.ncbi.nlm.nih.gov/rest/pug"
const CAS_PATTERN = /^\d{2,7}-\d{2}-\d$/

let lastRequestTime = 0

async function rateLimit() {
  const now = Date.now()
  const elapsed = now - lastRequestTime
  if (elapsed < 250) {
    await new Promise((r) => setTimeout(r, 250 - elapsed))
  }
  lastRequestTime = Date.now()
}

function extractCasFromSynonyms(synonyms: string[]): string | null {
  return synonyms.find((s) => CAS_PATTERN.test(s.trim())) ?? null
}

function extractIupacName(props: { urn: { label?: string; name?: string }; value: { sval?: string } }[]): string | null {
  const iupac = props.find(
    (p) => p.urn.label === "IUPAC Name" && p.urn.name === "Preferred"
  )
  return iupac?.value?.sval ?? null
}

function extractMolecularFormula(props: { urn: { label?: string }; value: { sval?: string } }[]): string | null {
  return props.find((p) => p.urn.label === "Molecular Formula")?.value?.sval ?? null
}

function extractMolecularWeight(props: { urn: { label?: string }; value: { fval?: number; sval?: string } }[]): number | null {
  const mw = props.find((p) => p.urn.label === "Molecular Weight")
  if (!mw) return null
  return mw.value?.fval ?? (mw.value?.sval ? parseFloat(mw.value.sval) : null)
}

function extractInchiKey(props: { urn: { label?: string }; value: { sval?: string } }[]): string | null {
  return props.find((p) => p.urn.label === "InChIKey")?.value?.sval ?? null
}

export async function fetchByIdentifier(identifier: string): Promise<PubChemResult | null> {
  await rateLimit()

  const encoded = encodeURIComponent(identifier.trim())

  try {
    const [compoundRes, synonymsRes] = await Promise.all([
      fetch(`${BASE}/compound/name/${encoded}/JSON`, { signal: AbortSignal.timeout(10000) }),
      fetch(`${BASE}/compound/name/${encoded}/synonyms/JSON`, { signal: AbortSignal.timeout(10000) }),
    ])

    if (!compoundRes.ok) return null

    const compoundJson = await compoundRes.json()
    const compound = compoundJson?.PC_Compounds?.[0]
    if (!compound) return null

    const cid: number = compound.id?.id?.cid
    const props = compound.props ?? []

    let synonyms: string[] = []
    if (synonymsRes.ok) {
      const synJson = await synonymsRes.json()
      synonyms = synJson?.InformationList?.Information?.[0]?.Synonym ?? []
    }

    const casNumber = extractCasFromSynonyms(synonyms)

    return {
      pubchemCid: cid,
      casNumber,
      iupacName: extractIupacName(props),
      commonName: casNumber
        ? (synonyms.find((s) => !CAS_PATTERN.test(s)) ?? identifier)
        : identifier,
      molecularFormula: extractMolecularFormula(props),
      molecularWeight: extractMolecularWeight(props),
      inchiKey: extractInchiKey(props),
      synonyms: synonyms.slice(0, 100), // cap to avoid massive inserts
    }
  } catch {
    return null
  }
}
