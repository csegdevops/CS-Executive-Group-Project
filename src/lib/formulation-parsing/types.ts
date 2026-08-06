import type { FormulationEntry } from "@/lib/import/formulation-parser"

// Output of the extraction step — either a native document (PDF, understood
// directly by the model) or plain text/image bytes already normalised from
// some other format. Keeps format-specific extraction out of provider
// adapters, mirroring src/lib/cv-parsing/types.ts's CvParseInput.
export type FormulationParseInput =
  | { kind: "pdf"; buffer: Buffer }
  | { kind: "image"; buffer: Buffer; mimeType: string }
  | { kind: "text"; text: string }

export interface AiFormulationParser {
  extractEntries(input: FormulationParseInput): Promise<Omit<FormulationEntry, "rowIndex">[]>
}
