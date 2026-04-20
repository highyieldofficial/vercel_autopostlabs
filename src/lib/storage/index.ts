/**
 * @autopostlabs/storage
 *
 * Supabase Storage wrapper for persisting generated and product images.
 * All images are stored in the `media` bucket with the following path structure:
 *
 *   generated/{businessId}/{postId}/{filename}.webp   — AI-generated post images
 *   products/{businessId}/{productId}/{filename}.webp  — mirrored product images
 */

import { createClient } from '@supabase/supabase-js'

// ─── Client ───────────────────────────────────────────────────────────────────

function getClient() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
  return createClient(url, key)
}

const BUCKET = () => process.env.SUPABASE_STORAGE_BUCKET ?? 'media'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UploadResult {
  key: string        // storage path (e.g. generated/biz123/post456/image.webp)
  publicUrl: string  // full public URL
}

// ─── Core upload ──────────────────────────────────────────────────────────────

/**
 * Upload a Buffer/Uint8Array to Supabase Storage.
 * Returns the storage key and public URL.
 */
export async function uploadBuffer(
  path: string,
  buffer: Buffer | Uint8Array,
  contentType = 'image/webp'
): Promise<UploadResult> {
  const supabase = getClient()
  const { error } = await supabase.storage
    .from(BUCKET())
    .upload(path, buffer, { contentType, upsert: true })

  if (error) throw new Error(`Supabase Storage upload failed: ${error.message}`)

  const { data } = supabase.storage.from(BUCKET()).getPublicUrl(path)
  return { key: path, publicUrl: data.publicUrl }
}

/**
 * Download an image from any URL and re-upload it to Supabase Storage.
 * Used to persist DALL-E generated images (which expire after ~24h).
 */
export async function mirrorUrl(
  sourceUrl: string,
  storagePath: string
): Promise<UploadResult> {
  const response = await fetch(sourceUrl)
  if (!response.ok) {
    throw new Error(`Failed to fetch image from ${sourceUrl}: ${response.statusText}`)
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  const contentType = response.headers.get('content-type') ?? 'image/jpeg'

  return uploadBuffer(storagePath, buffer, contentType)
}

/**
 * Delete a file from Supabase Storage.
 */
export async function deleteFile(path: string): Promise<void> {
  const supabase = getClient()
  const { error } = await supabase.storage.from(BUCKET()).remove([path])
  if (error) throw new Error(`Supabase Storage delete failed: ${error.message}`)
}

/**
 * Get a signed URL for a private file (if bucket is not public).
 * Falls back to public URL if the bucket is public.
 */
export async function getSignedUrl(path: string, expiresInSeconds = 3600): Promise<string> {
  const supabase = getClient()
  const { data, error } = await supabase.storage
    .from(BUCKET())
    .createSignedUrl(path, expiresInSeconds)

  if (error) throw new Error(`Failed to create signed URL: ${error.message}`)
  return data.signedUrl
}

// ─── Path helpers ─────────────────────────────────────────────────────────────

export function generatedImagePath(businessId: string, postId: string, index = 0): string {
  return `generated/${businessId}/${postId}/image-${index}.jpg`
}

export function productImagePath(businessId: string, productId: string, index = 0): string {
  return `products/${businessId}/${productId}/image-${index}.jpg`
}
