import crypto from 'node:crypto'
import { supabase } from './supabase.js'

export const BUCKET = 'uploads'

// Images arrive as data URLs in the JSON body rather than multipart form data.
// That costs ~33% in transfer and saves a dependency and a second body parser;
// the client resizes before sending, so the payloads are small enough that the
// trade is worth it. Run scripts/setup-storage.mjs once to create the bucket.
const DATA_URL = /^data:(image\/(?:png|jpe?g|webp|gif));base64,([A-Za-z0-9+/=]+)$/
const MAX_BYTES = 6 * 1024 * 1024

const EXTENSIONS = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

// Shape and size checks only — no network. Split out from the upload so a
// caller can reject a malformed image before doing any database work, and then
// hand the already-decoded bytes to uploadParsed rather than parsing twice.
// Returns { mime, bytes } or { error }.
export function parseDataUrl(dataUrl) {
  if (typeof dataUrl !== 'string') return { error: 'image must be a data URL string' }

  const match = DATA_URL.exec(dataUrl.trim())
  if (!match) return { error: 'image must be a base64 data URL (png, jpeg, webp or gif)' }

  const [, mime, base64] = match
  const bytes = Buffer.from(base64, 'base64')

  if (bytes.length === 0) return { error: 'image is empty' }
  if (bytes.length > MAX_BYTES) {
    return { error: `image must be ${Math.floor(MAX_BYTES / 1024 / 1024)}MB or smaller` }
  }

  return { mime, bytes }
}

// Returns { url } or { error }. `folder` separates avatars from post images so
// they can be reasoned about (and cleaned up) independently.
export async function uploadParsed({ mime, bytes }, folder) {
  const path = `${folder}/${Date.now()}-${crypto.randomUUID()}.${EXTENSIONS[mime]}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: mime,
    // Paths are unique per upload, so an overwrite would mean a uuid collision.
    upsert: false,
  })

  if (error) {
    // The most likely cause by far is the bucket not existing yet.
    if (/not found/i.test(error.message)) {
      return { error: 'image storage is not set up — run scripts/setup-storage.mjs' }
    }
    return { error: error.message }
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { url: data.publicUrl }
}

// Parse and upload in one step, for callers with nothing to do in between.
export async function uploadDataUrl(dataUrl, folder) {
  const parsed = parseDataUrl(dataUrl)
  if (parsed.error) return { error: parsed.error }
  return uploadParsed(parsed, folder)
}

// Best-effort tidy-up when a post or avatar goes away. A failure here is not
// worth failing the delete over — an orphaned image is harmless, and the
// alternative is refusing to remove a post because its picture wouldn't budge.
export async function removeByUrl(url) {
  if (typeof url !== 'string') return
  const marker = `/${BUCKET}/`
  const at = url.indexOf(marker)
  if (at === -1) return
  const path = url.slice(at + marker.length).split('?')[0]
  if (path) await supabase.storage.from(BUCKET).remove([path]).catch(() => {})
}
