import mammoth from "mammoth"
import type { CvParseInput } from "./types"

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

// Turns raw uploaded bytes into something a CvParser can actually read.
// PDFs pass through natively (providers like Gemini/Claude understand PDF
// bytes directly). .docx is unzipped and converted to text via mammoth —
// treating its raw bytes as UTF-8 text (the previous behavior) produced
// garbage, since .docx is a zip archive, not a text file. Legacy .doc
// (pre-2007 binary format) isn't supported by mammoth and isn't handled here.
export async function prepareDocumentInput(buffer: Buffer, mimeType: string): Promise<CvParseInput> {
  if (mimeType === "application/pdf") {
    return { kind: "pdf", buffer }
  }

  if (mimeType === DOCX_MIME) {
    const { value } = await mammoth.extractRawText({ buffer })
    return { kind: "text", text: value }
  }

  // Unknown/plain-text mime types — best-effort fallback.
  return { kind: "text", text: buffer.toString("utf-8") }
}
