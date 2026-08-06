import { geminiSummarizer } from "./gemini"
import type { Summarizer } from "./types"

export type { Summarizer } from "./types"

// Active provider — swap to a different adapter (Claude, OpenAI, ...) by
// implementing Summarizer and changing this one line. Call sites only
// depend on the Summarizer interface, never on this file's contents.
export const summarizer: Summarizer = geminiSummarizer
