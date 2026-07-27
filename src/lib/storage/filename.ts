export function buildDownloadFilename(
  firstName: string | null,
  lastName: string | null,
  docType: "cv" | "cl",
  ext: string
): string {
  const sanitize = (s: string) => s.trim().replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "")
  const name = [firstName, lastName].filter(Boolean).map((s) => sanitize(s as string)).filter(Boolean).join("_") || "Candidate"
  const label = docType === "cv" ? "Resume" : "CoverLetter"
  return `${name}_${label}.${ext}`
}
