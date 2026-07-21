import { createAdminClient } from "@/lib/supabase/admin"
import { uploadCvBuffer, fetchExternalFile } from "@/lib/storage/cv-storage"
import { parseCandidateCv } from "./parse-candidate"

type FileSource =
  | { buffer: Buffer; mimeType: string; originalName: string }
  | { url: string }

interface IngestCvParams {
  candidateId: string
  applicationId?: string
  docType: "cv" | "cl"
  source: FileSource
}

function extensionFor(mimeType: string, originalName: string): string {
  const fromName = originalName.split(".").pop()
  if (fromName && fromName.length <= 5) return fromName
  if (mimeType === "application/pdf") return "pdf"
  return "bin"
}

// Stores the file (uploading a buffer, or fetching+re-hosting an external
// URL from Seek/Gravity Forms), stamps it on the application if given, always
// overwrites the candidate's "latest" pointer, and — for CVs — parses it and
// non-destructively fills profile fields. Never throws: failures are logged
// so a parsing/storage outage never breaks the application-creation request
// that triggered it.
export async function ingestCv(params: IngestCvParams): Promise<void> {
  try {
    const file = "url" in params.source
      ? await fetchExternalFile(params.source.url)
      : params.source

    const ext = extensionFor(file.mimeType, "originalName" in file ? file.originalName : "resume")
    const originalName = "originalName" in file ? file.originalName : `resume.${ext}`

    const { storageKey } = await uploadCvBuffer({
      path: `candidates/${params.candidateId}/latest-${params.docType}.${ext}`,
      buffer: file.buffer,
      mimeType: file.mimeType,
      originalName,
    })

    const admin = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recruitment = admin.schema("recruitment") as any

    const candidateUpdate: Record<string, unknown> = params.docType === "cv"
      ? { cv_storage_key: storageKey, cv_original_name: originalName }
      : { cl_storage_key: storageKey, cl_original_name: originalName }

    await recruitment.from("candidates").update(candidateUpdate).eq("id", params.candidateId)

    if (params.applicationId) {
      const appPath = `applications/${params.applicationId}/${params.docType}.${ext}`
      const { storageKey: appStorageKey } = await uploadCvBuffer({
        path: appPath,
        buffer: file.buffer,
        mimeType: file.mimeType,
        originalName,
      })
      const appUpdate: Record<string, unknown> = params.docType === "cv"
        ? { cv_storage_key: appStorageKey, cv_original_name: originalName }
        : { cl_storage_key: appStorageKey, cl_original_name: originalName }
      await recruitment.from("applications").update(appUpdate).eq("id", params.applicationId)
    }

    if (params.docType !== "cv") return

    await parseCandidateCv(params.candidateId, file.buffer, file.mimeType)
  } catch (err) {
    // parseCandidateCv already marks cv_parse_status = 'failed' on its own
    // failures; this catch also covers storage/upload errors before parsing
    // even started, so a failure anywhere in ingestion never breaks the
    // application-creation request that triggered it.
    console.error("[cv-ingest] failed", err)
  }
}
