import { createAdminClient } from "@/lib/supabase/admin"

const BUCKET = "job-documents"

export async function uploadJobFile(params: {
  path: string
  buffer: Buffer
  mimeType: string
}): Promise<{ storageKey: string }> {
  const admin = createAdminClient()
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(params.path, params.buffer, { contentType: params.mimeType, upsert: true })

  if (error) throw new Error(`Job file upload failed: ${error.message}`)
  return { storageKey: params.path }
}

export async function downloadJobFile(storageKey: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const admin = createAdminClient()
  const { data, error } = await admin.storage.from(BUCKET).download(storageKey)
  if (error || !data) throw new Error(`Job file download failed: ${error?.message ?? "not found"}`)

  const buffer = Buffer.from(await data.arrayBuffer())
  return { buffer, mimeType: data.type || "application/octet-stream" }
}

export async function deleteJobFile(storageKey: string): Promise<void> {
  const admin = createAdminClient()
  const { error } = await admin.storage.from(BUCKET).remove([storageKey])
  if (error) throw new Error(`Job file delete failed: ${error.message}`)
}

// Used by the WordPress push route to fetch the hero image bytes so they can
// be uploaded into WP's own media library — WP needs a public URL, and this
// bucket is deliberately private (service-role only), so we hand it the
// bytes directly rather than exposing a signed URL from our own storage.
export async function getJobFileBuffer(storageKey: string): Promise<{ buffer: Buffer; mimeType: string }> {
  return downloadJobFile(storageKey)
}
