import { GoogleGenAI, createUserContent, createPartFromText } from "@google/genai"
import type { Summarizer } from "./types"

const MODEL = "gemini-2.5-flash"

export const geminiSummarizer: Summarizer = {
  async summarize(prompt: string): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new Error("GEMINI_API_KEY not configured")

    const ai = new GoogleGenAI({ apiKey })

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: createUserContent([createPartFromText(prompt)]),
      config: {
        // attempts: 1 disables the SDK's default 5-attempt exponential-backoff
        // retry (up to ~60s between attempts) — a transient failure should
        // surface quickly and let the user-facing Retry/Regenerate button
        // recover it, not silently retry for minutes.
        httpOptions: { timeout: 45_000, retryOptions: { attempts: 1 } },
      },
    })

    const text = response.text
    if (!text) throw new Error("Gemini returned no output")
    return text.trim()
  },
}
