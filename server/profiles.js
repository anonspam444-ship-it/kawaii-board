import express from 'express'
import { supabase } from './supabase.js'
import { dbError } from './dbError.js'
import { rateLimit } from './rateLimit.js'
import { parseDataUrl, uploadParsed, removeByUrl } from './uploads.js'

// A profile is a name and a picture hung off the client_id the browser made up
// for itself. Still no accounts and still no password — anyone who sends
// somebody else's client_id can overwrite their profile. That is the same
// signature-not-a-lock trade the entry bylines make, extended to avatars.
//
// Unlike the entry author column, which snapshots a name at pin time, posts
// reference the profile live: change your picture and every post you have made
// shows the new one.
export const profileRouter = express.Router()

export const MAX_NAME = 40

const jsonWithImage = express.json({ limit: '9mb' })

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const limiter = rateLimit({ name: 'profile', max: 20, windowMs: 10 * 60 * 1000 })

// GET /api/profile/:clientId — so a returning browser can recover the avatar
// it uploaded even if localStorage lost the URL.
profileRouter.get('/:clientId', async (req, res) => {
  if (!UUID.test(req.params.clientId)) {
    return res.status(400).json({ error: 'client_id must be a uuid' })
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('client_id, name, avatar_url')
    .eq('client_id', req.params.clientId)
    .maybeSingle()

  if (error) return res.status(500).json({ error: dbError(error) })
  if (!data) return res.status(404).json({ error: 'no profile yet' })
  res.json(data)
})

// PUT /api/profile — { client_id, name, avatar?, remove_avatar? }
//
// `avatar` is a base64 data URL. Omitting it keeps whatever is already stored,
// so renaming yourself doesn't require re-uploading your picture; passing
// remove_avatar drops it.
profileRouter.put('/', limiter, jsonWithImage, async (req, res) => {
  const { client_id: rawClientId, name, avatar, remove_avatar: removeAvatar } = req.body ?? {}

  if (!UUID.test(rawClientId ?? '')) {
    return res.status(400).json({ error: 'client_id must be a uuid' })
  }

  const trimmed = typeof name === 'string' ? name.trim() : ''
  if (!trimmed) return res.status(400).json({ error: 'name is required' })
  if (trimmed.length > MAX_NAME) {
    return res.status(400).json({ error: `name must be ${MAX_NAME} characters or fewer` })
  }

  // Check the picture's shape before any database work: a malformed upload is
  // the caller's mistake and shouldn't cost a round trip to find out.
  let parsedAvatar = null
  if (avatar && !removeAvatar) {
    parsedAvatar = parseDataUrl(avatar)
    if (parsedAvatar.error) return res.status(400).json({ error: parsedAvatar.error })
  }

  const { data: existing, error: readError } = await supabase
    .from('profiles')
    .select('avatar_url')
    .eq('client_id', rawClientId)
    .maybeSingle()

  if (readError) return res.status(500).json({ error: dbError(readError) })

  let avatarUrl = existing?.avatar_url ?? null
  let replaced = null

  if (removeAvatar) {
    replaced = avatarUrl
    avatarUrl = null
  } else if (parsedAvatar) {
    const upload = await uploadParsed(parsedAvatar, 'avatars')
    if (upload.error) return res.status(400).json({ error: upload.error })
    replaced = avatarUrl // the one being superseded, if any
    avatarUrl = upload.url
  }

  const { data, error } = await supabase
    .from('profiles')
    .upsert(
      {
        client_id: rawClientId,
        name: trimmed,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'client_id' },
    )
    .select('client_id, name, avatar_url')
    .single()

  if (error) {
    // Don't leave the just-uploaded file behind if the row didn't land.
    if (avatarUrl && avatarUrl !== existing?.avatar_url) await removeByUrl(avatarUrl)
    return res.status(500).json({ error: dbError(error) })
  }

  // Only now that the new URL is committed is the old one safe to bin.
  if (replaced && replaced !== avatarUrl) await removeByUrl(replaced)

  res.json(data)
})
