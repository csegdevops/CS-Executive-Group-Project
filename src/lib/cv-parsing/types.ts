export interface ParsedEducation {
  institution: string
  degree: string | null
  field_of_study: string | null
  start_date: string | null
  end_date: string | null
}

export interface ParsedWorkExperience {
  employer: string
  title: string
  start_date: string | null
  end_date: string | null
  description: string | null
}

export interface ParsedResume {
  phone: string | null
  current_title: string | null
  current_employer: string | null
  location_city: string | null
  location_state: string | null
  // Freeform, human-readable extraction — never filtered to a fixed
  // vocabulary. Kept alongside the controlled tag lists below so nothing
  // is lost when a real skill/field isn't (yet) in the controlled lists.
  skills: string[]
  education: ParsedEducation[]
  work_experience: ParsedWorkExperience[]
  raw_text: string
  // Controlled-vocabulary matches — every value is guaranteed to be one of
  // the options passed in via CvParseVocabulary, selected by the model
  // itself from the whole CV (not a separate fuzzy-match pass).
  matched_skill_tags: string[]
  matched_education_tags: string[]
}

// Output of the extraction step — either a native PDF (sent to the provider
// as a document part) or plain text already pulled out of some other format
// (e.g. .docx via mammoth). Keeps format-specific extraction out of provider
// adapters, so every adapter only ever deals with one of these two shapes.
export type CvParseInput =
  | { kind: "pdf"; buffer: Buffer }
  | { kind: "text"; text: string }

// The candidate's/organization's controlled tag vocabularies (from
// lookup_values), passed in at call time since they're admin-editable data,
// not something a provider adapter should hardcode.
export interface CvParseVocabulary {
  skillTags: string[]
  educationFields: string[]
}

export interface CvParser {
  parseResume(input: CvParseInput, vocabulary: CvParseVocabulary): Promise<ParsedResume>
}
