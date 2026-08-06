import mammoth from "mammoth"
import type { FormulationParseInput } from "./types"

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

// Turns raw uploaded bytes into something an AiFormulationParser can read.
// PDFs and images pass through natively (Gemini understands both directly
// as document/image parts). .docx is unzipped and converted to text via
// mammoth, same approach as src/lib/cv-parsing/extract.ts.
export async function prepareFormulationInput(buffer: Buffer, mimeType: string): Promise<FormulationParseInput> {
  if (mimeType === "application/pdf") {
    return { kind: "pdf", buffer }
  }

  if (mimeType === DOCX_MIME) {
    const { value } = await mammoth.extractRawText({ buffer })
    return { kind: "text", text: value }
  }

  if (mimeType.startsWith("image/")) {
    return { kind: "image", buffer, mimeType }
  }

  // Unknown/plain-text mime types — best-effort fallback.
  return { kind: "text", text: buffer.toString("utf-8") }
}
