// Creates the Supabase Storage bucket the feed uploads into.
//
//   node scripts/setup-storage.mjs
//
// Idempotent: re-running reports the bucket already exists and updates its
// limits. Buckets can't be made through the SQL editor, which is why this is a
// script rather than another line in migrations/.
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

export const BUCKET = 'uploads'

// Public read: avatars and post images are shown to everyone who loads the
// board, so the alternative is minting signed URLs on every render for content
// that isn't secret. Writes still go only through the server.
const CONFIG = {
  public: true,
  fileSizeLimit: 8 * 1024 * 1024,
  allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
}

const url = (process.env.SUPABASE_URL ?? '').trim().replace(/\/+$/, '').replace(/\/rest\/v1$/, '')
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('[setup-storage] Missing SUPABASE_URL / SUPABASE_SECRET_KEY. Run from server/.env.')
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { persistSession: false } })

const { error: createError } = await supabase.storage.createBucket(BUCKET, CONFIG)

if (createError && !/already exists/i.test(createError.message)) {
  console.error(`[setup-storage] could not create "${BUCKET}": ${createError.message}`)
  process.exit(1)
}

// Either it was just created or it predates this run; either way make sure the
// limits match what the server expects.
const { error: updateError } = await supabase.storage.updateBucket(BUCKET, CONFIG)
if (updateError) {
  console.error(`[setup-storage] could not update "${BUCKET}": ${updateError.message}`)
  process.exit(1)
}

const { data } = await supabase.storage.getBucket(BUCKET)
console.log(
  `[setup-storage] bucket "${BUCKET}" ready —`,
  `public: ${data?.public}, limit: ${data?.file_size_limit} bytes`,
)
