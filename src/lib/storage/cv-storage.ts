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
// staying reachable.
export async function fetchExternalFile(url: string): Promise<{ buffer: Buffer; mimeType: string; originalName: string }> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch external file: ${res.status}`)

  const mimeType = res.headers.get("content-type") ?? "application/octet-stream"
  const buffer = Buffer.from(await res.arrayBuffer())
  const originalName = new URL(url).pathname.split("/").pop() || "resume"

  return { buffer, mimeType, originalName }
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
  docType: "cv" | "cl"
): Promise<Response> {
  const { buffer, mimeType } = await downloadCvBuffer(storageKey)
  const ext = storageKey.split(".").pop() || "bin"
  const filename = buildDownloadFilename(firstName, lastName, docType, ext)
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

export async function getCvSignedUrl(storageKey: string, expiresInSeconds = 300): Promise<string | null> {
  const admin = createAdminClient()
  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(storageKey, expiresInSeconds)

  if (error || !data) return null
  return data.signedUrl
}
