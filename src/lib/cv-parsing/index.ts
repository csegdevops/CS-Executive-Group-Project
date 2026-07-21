import { geminiCvParser } from "./gemini"
import type { CvParser } from "./types"

export type { ParsedResume, ParsedEducation, ParsedWorkExperience, CvParser } from "./types"

// Active provider — swap to a different adapter (Claude, OpenAI, ...) by
// implementing CvParser and changing this one line. Call sites only depend
// on the CvParser interface, never on this file's contents.
export const cvParser: CvParser = geminiCvParser
