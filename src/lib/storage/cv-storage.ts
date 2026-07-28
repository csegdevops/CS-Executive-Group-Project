import { createAdminClient } from "@/lib/supabase/admin"
import { buildDownloadFilename } from "./filename"

const BUCKET = "candidate-documents"

export interface StoredFile {
  storageKey: string
  originalName: string
  buffer: Buffer
  mimeType: string
}

export async function uploadCvBuffer(params: {
  path: string
  buffer: Buffer
  mimeType: string
  originalName: string
}): Promise<{ storageKey: string; originalName: string }> {
  const admin = createAdminClient()
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(params.path, params.buffer, { contentType: params.mimeType, upsert: true })

  if (error) throw new Error(`CV upload failed: ${error.message}`)
  return { storageKey: params.path, originalName: params.originalName }
}

// Downloads a file from an external, source-provided URL (Seek, Gravity Forms)
// so we hold a durable copy of our own rather than depending on the source
// staying reachable. Retries a few times with a short delay — WordPress file
// upload plugins (e.g. a "rename uploaded file" hook) can leave a brief
// window where the entry's recorded URL doesn't 404 by the time gform's
// after-submission hook fires but the physical file isn't actually there
// yet. This runs inside ingestCv's after() callback, so the extra latency
// never affects the request that triggered it.
export async function fetchExternalFile(
  url: string,
  attempts = 3,
  retryDelayMs = 2000
): Promise<{ buffer: Buffer; mimeType: string; originalName: string }> {
  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Failed to fetch external file: ${res.status}`)

      const mimeType = res.headers.get("content-type") ?? "application/octet-stream"
      const buffer = Buffer.from(await res.arrayBuffer())
      const originalName = new URL(url).pathname.split("/").pop() || "resume"

      return { buffer, mimeType, originalName }
    } catch (err) {
      lastError = err
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, retryDelayMs))
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

export async function downloadCvBuffer(storageKey: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const admin = createAdminClient()
  const { data, error } = await admin.storage.from(BUCKET).download(storageKey)
  if (error || !data) throw new Error(`CV download failed: ${error?.message ?? "not found"}`)

  const buffer = Buffer.from(await data.arrayBuffer())
  return { buffer, mimeType: data.type || "application/octet-stream" }
}

export async function buildCvDownloadResponse(
  storageKey: string,
  firstName: string | null,
  lastName: string | null,
  docType: "cv" | "cl",
  position = 1
): Promise<Response> {
  const { buffer, mimeType } = await downloadCvBuffer(storageKey)
  const ext = storageKey.split(".").pop() || "bin"
  const filename = buildDownloadFilename(firstName, lastName, docType, ext, position)
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": mimeType,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}

export async function deleteCvFile(storageKey: string): Promise<void> {
  const admin = createAdminClient()
  const { error } = await admin.storage.from(BUCKET).remove([storageKey])
  if (error) throw new Error(`CV delete failed: ${error.message}`)
}

// Keeps a candidate's document history down to the 3 most recent rows per
// doc_type — call after inserting a new candidate_documents row, or after
// repointing rows onto a candidate (e.g. a merge) that could push it over.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function pruneCandidateDocuments(recruitment: any, candidateId: string, docType: "cv" | "cl"): Promise<void> {
  const { data: history } = await recruitment
    .from("candidate_documents")
    .select("id, storage_key")
    .eq("candidate_id", candidateId)
    .eq("doc_type", docType)
    .order("created_at", { ascending: false })

  const excess = (history ?? []).slice(3) as { id: string; storage_key: string }[]
  if (excess.length === 0) return

  await Promise.all(excess.map((d) => deleteCvFile(d.storage_key).catch((err) => console.error("[cv-prune] failed", err))))
  await recruitment.from("candidate_documents").delete().in("id", excess.map((d) => d.id))
}

export async function getCvSignedUrl(storageKey: string, expiresInSeconds = 300): Promise<string | null> {
  const admin = createAdminClient()
  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(storageKey, expiresInSeconds)

  if (error || !data) return null
  return data.signedUrl
}
