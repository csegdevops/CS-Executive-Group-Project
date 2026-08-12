import { randomUUID } from "crypto"
import { createAdminClient } from "@/lib/supabase/admin"
import { uploadCvBuffer, fetchExternalFile, pruneCandidateDocuments } from "@/lib/storage/cv-storage"
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

interface IngestedFile {
  candidateId: string
  docType: "cv" | "cl"
  buffer: Buffer
  mimeType: string
}

function extensionFor(mimeType: string, originalName: string): string {
  const fromName = originalName.split(".").pop()
  if (fromName && fromName.length <= 5) return fromName
  if (mimeType === "application/pdf") return "pdf"
  return "bin"
}

// Stores the file (uploading a buffer, or fetching+re-hosting an external
// URL from Seek/Gravity Forms) and records it in the candidate's document
// history (pruned to the 3 most recent per doc_type — "current" is always
// just the newest row, there's no separate pointer to keep in sync), stamping
// it on the application if given with its own permanent copy. Deliberately
// split from parsing (parseCvAfterIngest) so a caller fed an external URL
// (WordPress/Seek) can `await` this *before* responding to that webhook —
// the source file can disappear moments after the webhook request completes
// (observed with Gravity Forms when "save entry" is off, which stops
// retaining the uploaded file once the entry itself isn't persisted), so
// downloading as early as possible — before, not after, the response —
// closes that race. Never throws: storage/network failures are logged and
// produce a null return rather than breaking the caller's request.
export async function ingestCvFile(params: IngestCvParams): Promise<IngestedFile | null> {
  try {
    const file = "url" in params.source
      ? await fetchExternalFile(params.source.url)
      : params.source

    const ext = extensionFor(file.mimeType, "originalName" in file ? file.originalName : "resume")
    const originalName = "originalName" in file ? file.originalName : `resume.${ext}`

    const docId = randomUUID()
    const candidatePath = `candidates/${params.candidateId}/${params.docType}-${docId}.${ext}`
    const { storageKey } = await uploadCvBuffer({
      path: candidatePath,
      buffer: file.buffer,
      mimeType: file.mimeType,
      originalName,
    })

    const admin = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recruitment = admin.schema("recruitment") as any

    await recruitment.from("candidate_documents").insert({
      id: docId,
      candidate_id: params.candidateId,
      application_id: params.applicationId ?? null,
      doc_type: params.docType,
      storage_key: storageKey,
      original_name: originalName,
    })

    await pruneCandidateDocuments(recruitment, params.candidateId, params.docType)

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

    return { candidateId: params.candidateId, docType: params.docType, buffer: file.buffer, mimeType: file.mimeType }
  } catch (err) {
    console.error("[cv-ingest] file download/storage failed", err)
    return null
  }
}

// The slow step (Gemini parsing, can take well over a minute) — safe to run
// via after() since it operates on the buffer ingestCvFile already captured,
// no race against the source file's lifetime. No-ops for cover letters.
export async function parseCvAfterIngest(file: IngestedFile): Promise<void> {
  if (file.docType !== "cv") return
  try {
    // parseCandidateCv already marks cv_parse_status = 'failed' on its own
    // failures; this catch is a last resort for anything else unexpected.
    await parseCandidateCv(file.candidateId, file.buffer, file.mimeType)
  } catch (err) {
    console.error("[cv-ingest] parse failed", err)
  }
}

// Convenience wrapper for callers with no race to worry about (e.g. a
// recruiter's direct browser upload, or a candidate-provided buffer) —
// downloads/stores and parses in one call, safe to run entirely via after().
export async function ingestCv(params: IngestCvParams): Promise<void> {
  const file = await ingestCvFile(params)
  if (file) await parseCvAfterIngest(file)
}
