import { GoogleGenAI, Type, createUserContent, createPartFromBase64, createPartFromText } from "@google/genai"
import type { CvParser, CvParseInput, CvParseVocabulary, ParsedResume } from "./types"

const MODEL = "gemini-2.5-flash"

function buildSchema(vocab: CvParseVocabulary, includeRawText: boolean) {
  return {
    type: Type.OBJECT,
    properties: {
      phone: { type: Type.STRING, nullable: true },
      current_title: { type: Type.STRING, nullable: true },
      current_employer: { type: Type.STRING, nullable: true },
      location_city: { type: Type.STRING, nullable: true },
      location_state: { type: Type.STRING, nullable: true },
      skills: { type: Type.ARRAY, items: { type: Type.STRING } },
      matched_skill_tags: { type: Type.ARRAY, items: { type: Type.STRING, enum: vocab.skillTags } },
      matched_education_tags: { type: Type.ARRAY, items: { type: Type.STRING, enum: vocab.educationFields } },
      education: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            institution: { type: Type.STRING },
            degree: { type: Type.STRING, nullable: true },
            field_of_study: { type: Type.STRING, nullable: true },
            start_date: { type: Type.STRING, nullable: true },
            end_date: { type: Type.STRING, nullable: true },
          },
          required: ["institution"],
        },
      },
      work_experience: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            employer: { type: Type.STRING },
            title: { type: Type.STRING },
            start_date: { type: Type.STRING, nullable: true },
            end_date: { type: Type.STRING, nullable: true },
            description: { type: Type.STRING, nullable: true },
          },
          required: ["employer", "title"],
        },
      },
      ...(includeRawText ? { raw_text: { type: Type.STRING } } : {}),
    },
    required: [
      "skills", "matched_skill_tags", "matched_education_tags", "education", "work_experience",
      ...(includeRawText ? ["raw_text"] : []),
    ],
  }
}

function buildPrompt(vocab: CvParseVocabulary, includeRawText: boolean): string {
  return `Extract structured data from this resume/CV.

Return the candidate's phone number, current/most recent job title and employer, city and state they're located in, their full education history, and their full work experience history. Use null for any field that isn't present. Dates should be in whatever format the document uses (e.g. "2022" or "Jan 2022").

Also return two lists:
- "skills": a freeform list of every skill, tool, or technology genuinely evidenced in the CV (not constrained to any fixed list).
- "matched_skill_tags": from this fixed list only — ${vocab.skillTags.join(", ")} — return every tag that reasonably applies based on the candidate's overall experience, even if the exact word doesn't appear verbatim (e.g. "led agile software delivery" implies project_management). Do not invent values outside this list.
- "matched_education_tags": from this fixed list only — ${vocab.educationFields.join(", ")} — return every broad field of study that applies to the candidate's education history. Do not invent values outside this list.
${includeRawText ? '\nAlso return a plain-text transcript of the entire document\'s content (raw_text — no markdown or formatting, just the text).' : ""}`
}

export const geminiCvParser: CvParser = {
  async parseResume(input: CvParseInput, vocabulary: CvParseVocabulary): Promise<ParsedResume> {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new Error("GEMINI_API_KEY not configured")

    const ai = new GoogleGenAI({ apiKey })

    const documentPart = input.kind === "pdf"
      ? createPartFromBase64(input.buffer.toString("base64"), "application/pdf")
      : createPartFromText(input.text)

    // Only PDFs need Gemini to also produce a raw-text transcript — for
    // already-extracted text (.docx via mammoth) we already have it verbatim.
    const includeRawText = input.kind === "pdf"

    console.log(`[gemini] calling generateContent, model=${MODEL}, input.kind=${input.kind}`)
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: createUserContent([documentPart, createPartFromText(buildPrompt(vocabulary, includeRawText))]),
      config: {
        responseMimeType: "application/json",
        responseSchema: buildSchema(vocabulary, includeRawText),
        // attempts: 1 disables the SDK's default 5-attempt exponential-backoff
        // retry (up to ~60s between attempts) — a transient failure should
        // surface quickly and let the user-facing Retry button recover it,
        // not silently retry for minutes.
        httpOptions: { timeout: 45_000, retryOptions: { attempts: 1 } },
      },
    })
    console.log(`[gemini] generateContent returned`)

    const text = response.text
    if (!text) throw new Error("Gemini returned no output")

    const parsed = JSON.parse(text)
    return {
      phone: parsed.phone ?? null,
      current_title: parsed.current_title ?? null,
      current_employer: parsed.current_employer ?? null,
      location_city: parsed.location_city ?? null,
      location_state: parsed.location_state ?? null,
      skills: Array.isArray(parsed.skills) ? parsed.skills : [],
      matched_skill_tags: Array.isArray(parsed.matched_skill_tags) ? parsed.matched_skill_tags : [],
      matched_education_tags: Array.isArray(parsed.matched_education_tags) ? parsed.matched_education_tags : [],
      education: Array.isArray(parsed.education) ? parsed.education : [],
      work_experience: Array.isArray(parsed.work_experience) ? parsed.work_experience : [],
      raw_text: input.kind === "text" ? input.text : (typeof parsed.raw_text === "string" ? parsed.raw_text : ""),
    }
  },
}
