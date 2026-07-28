// `position` ranks this document among the candidate's retained documents of
// the same doc_type, newest-first (1 = current). Included in the filename so
// downloading all of a candidate's CVs doesn't produce identically-named
// files that collide/overwrite locally. Defaults to 1 for callers that only
// ever have a single copy (e.g. an application's own permanent CV/CL, which
// isn't part of the rolling-3 candidate-profile history).
export function buildDownloadFilename(
  firstName: string | null,
  lastName: string | null,
  docType: "cv" | "cl",
  ext: string,
  position = 1
): string {
  const sanitize = (s: string) => s.trim().replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "")
  const name = [firstName, lastName].filter(Boolean).map((s) => sanitize(s as string)).filter(Boolean).join("_") || "Candidate"
  const label = docType === "cv" ? "Resume" : "CoverLetter"
  return `${name}_${label}_${position}.${ext}`
}
