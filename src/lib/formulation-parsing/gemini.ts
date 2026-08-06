import { GoogleGenAI, Type, createUserContent, createPartFromBase64, createPartFromText } from "@google/genai"
import type { AiFormulationParser, FormulationParseInput } from "./types"
import type { FormulationEntry } from "@/lib/import/formulation-parser"

const MODEL = "gemini-2.5-flash"

const SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      inciName:      { type: Type.STRING, nullable: true },
      casNumber:     { type: Type.STRING, nullable: true },
      altCas:        { type: Type.STRING, nullable: true },
      concentration: { type: Type.NUMBER, nullable: true },
      function:      { type: Type.STRING, nullable: true },
      productName:   { type: Type.STRING, nullable: true },
    },
    required: ["inciName", "casNumber", "altCas", "concentration", "function", "productName"],
  },
}

const PROMPT = `Extract every distinct ingredient row from this client formulation document. The document may be a spreadsheet with non-standard column names, a PDF spec sheet, a Word document, or a photo/scan of a formulation list.

For each ingredient, return:
- "inciName": the INCI/chemical/ingredient name as written.
- "casNumber": the primary CAS registry number, if present (format like "64-17-5"). Null if not present.
- "altCas": an alternative/secondary CAS number, only if the document explicitly lists one in addition to the primary. Null otherwise.
- "concentration": the concentration as a plain number representing a percentage (e.g. 12.5 for "12.5%" or "12.5% w/w"). Null if not present.
- "function": the ingredient's stated function/role/purpose in the formulation, if given. Null otherwise.
- "productName": the name of the product this ingredient belongs to, if the document covers multiple products. Null if there's only one product or it isn't named.

Only include rows that have at least an ingredient name or a CAS number. Do not invent values that aren't in the document — use null for anything not present.`

export const geminiFormulationParser: AiFormulationParser = {
  async extractEntries(input: FormulationParseInput): Promise<Omit<FormulationEntry, "rowIndex">[]> {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new Error("GEMINI_API_KEY not configured")

    const ai = new GoogleGenAI({ apiKey })

    const documentPart =
      input.kind === "pdf"   ? createPartFromBase64(input.buffer.toString("base64"), "application/pdf") :
      input.kind === "image" ? createPartFromBase64(input.buffer.toString("base64"), input.mimeType) :
      createPartFromText(input.text)

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: createUserContent([documentPart, createPartFromText(PROMPT)]),
      config: {
        responseMimeType: "application/json",
        responseSchema: SCHEMA,
        // attempts: 1 disables the SDK's default 5-attempt exponential-backoff
        // retry — a transient failure should surface quickly so the caller's
        // fallback/retry UI can recover it, not silently retry for minutes.
        // timeout: bumped from 45s alongside cv-parsing/gemini.ts — a
        // multi-page PDF/scan formulation doc can take well over 45s of
        // Gemini "thinking" time, same root cause that was failing CV parses.
        httpOptions: { timeout: 100_000, retryOptions: { attempts: 1 } },
      },
    })

    const text = response.text
    if (!text) throw new Error("Gemini returned no output")

    const parsed = JSON.parse(text)
    if (!Array.isArray(parsed)) throw new Error("Gemini returned an unexpected shape")

    return parsed.map((row: Record<string, unknown>) => ({
      inciName:      typeof row.inciName === "string" ? row.inciName : null,
      casNumber:     typeof row.casNumber === "string" ? row.casNumber : null,
      altCas:        typeof row.altCas === "string" ? row.altCas : null,
      concentration: typeof row.concentration === "number" ? row.concentration : null,
      function:      typeof row.function === "string" ? row.function : null,
      productName:   typeof row.productName === "string" ? row.productName : null,
    }))
  },
}
