export interface PubChemResult {
  pubchemCid: number
  casNumber: string | null
  iupacName: string | null
  commonName: string
  molecularFormula: string | null
  molecularWeight: number | null
  inchiKey: string | null
  synonyms: string[]
}

export interface ResolutionResult {
  resolved: boolean
  chemical: PubChemResult | null
  source: "pubchem" | "manual"
  error?: string
}
