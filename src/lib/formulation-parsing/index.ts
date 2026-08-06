import { geminiFormulationParser } from "./gemini"
import type { AiFormulationParser } from "./types"

export type { AiFormulationParser, FormulationParseInput } from "./types"
export { prepareFormulationInput } from "./extract"

// Active provider — swap to a different adapter (Claude, OpenAI, ...) by
// implementing AiFormulationParser and changing this one line. Call sites
// only depend on the AiFormulationParser interface, never on this file's
// contents. Mirrors src/lib/cv-parsing/index.ts.
export const aiFormulationParser: AiFormulationParser = geminiFormulationParser
