import express from 'express'
import { supabase } from './supabase.js'
import { dbError } from './dbError.js'
import { rateLimit } from './rateLimit.js'
import { uploadDataUrl, removeByUrl } from './uploads.js'
import { recordEvent } from './events.js'

// The shared timeline. Anyone may post, like and comment — there is no
// credential for writing here, only a client_id the browser made up about
// itself. That is what "one big feed anyone can post to" means, and it is
// worth being clear-eyed about: the rate limits below are the only thing
// standing between this and a spam cannon. Moderation is a board-passphrase
// delete, at the bottom of this file.
export const feedRouter = express.Router()

export const MAX_BODY = 500
export const MAX_COMMENT = 300

// A feeling is an emoji plus a few words the poster typed. Either half can
// stand alone.
//
// The emoji is stored as its key. The server doesn't hold the list — that
// lives in the client, which is the only place that needs to render it — so
// this only checks the shape. An unknown key renders as no face.
const FEELING = /^[a-z][a-z0-9-]{0,23}$/

// Short on purpose: this is a mood, not a second post body. It sits on one
// line next to the face and has to stay readable there.
export const MAX_FEELING_TEXT = 40

function readFeelingText(value) {
  if (value === undefined || value === null) return { value: null }
  if (typeof value !== 'string') return { error: 'feeling text must be text' }
  const trimmed = value.trim().replace(/\s+/g, ' ')
  if (!trimmed) return { value: null }
  if (trimmed.length > MAX_FEELING_TEXT) {
    return { error: `feeling must be ${MAX_FEELING_TEXT} characters or fewer` }
  }
  return { value: trimmed }
}

function readFeeling(value) {
  if (value === undefined || value === null || value === '') return { value: null }
  if (typeof value !== 'string') return { error: 'feeling must be text' }
  const trimmed = value.trim().toLowerCase()
  if (!trimmed) return { value: null }
  if (!FEELING.test(trimmed)) return { error: 'feeling is not a valid name' }
  return { value: trimmed }
}

// Only applied to the routes that can carry an image; the global parser stays
// small so a 9MB body can't be aimed at every other endpoint on the server.
const jsonWithImage = express.json({ limit: '9mb' })

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const postLimit = rateLimit({
  name: 'post',
  max: 8,
  windowMs: 10 * 60 * 1000,
  message: 'You are posting very fast. Give it a few minutes.',
})

const commentLimit = rateLimit({ name: 'comment', max: 30, windowMs: 10 * 60 * 1000 })
const likeLimit = rateLimit({ name: 'like', max: 200, windowMs: 10 * 60 * 1000 })

// Every write says who it is from. Unverifiable by design — see the migration.
function readClientId(value) {
  return UUID.test(value ?? '') ? value : null
}

const isBadUuid = (error) => error?.code === '22P02'

// ---------------------------------------------------------------------------
// GET /api/feed — newest first, with authors, likes and comments attached.
// ---------------------------------------------------------------------------
// Likes and comments come back embedded (they have real foreign keys to
// posts), but profiles are fetched separately and stitched in: there is
// deliberately no FK from posts to profiles, so PostgREST can't embed them.
// Three round trips total, which is the right shape for a board this size.
feedRouter.get('/', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 100)
  const me = readClientId(req.query.client_id)

  const { data: posts, error } = await supabase
    .from('posts')
    .select(
      'id, client_id, body, image_url, feeling, feeling_text, created_at, ' +
        'post_likes ( client_id ), ' +
        'post_comments ( id, client_id, body, created_at )',
    )
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return res.status(500).json({ error: dbError(error) })

  const ids = new Set()
  for (const post of posts) {
    ids.add(post.client_id)
    for (const comment of post.post_comments) ids.add(comment.client_id)
    // Likers too, so the button can say who they were.
    for (const like of post.post_likes) ids.add(like.client_id)
  }

  const authors = new Map()
  if (ids.size) {
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('client_id, name, avatar_url')
      .in('client_id', [...ids])

    if (profileError) return res.status(500).json({ error: dbError(profileError) })
    for (const profile of profiles) authors.set(profile.client_id, profile)
  }

  // A post whose author never saved a profile still renders, as "someone".
  //
  // client_id is deliberately NOT included. It is the credential the delete
  // routes check, and this endpoint is public — returning it let anyone read
  // the feed, harvest an author's id, and delete their posts with no
  // passphrase at all. The browser already knows its own id; what it needs
  // from us is the `mine` flag, which the server works out below.
  const author = (clientId) => {
    const profile = authors.get(clientId)
    return { name: profile?.name ?? null, avatar_url: profile?.avatar_url ?? null }
  }

  // Names only, for the like button's tooltip — same reasoning as above.
  const likerName = (clientId) => authors.get(clientId)?.name ?? null

  res.json(
    posts.map((post) => ({
      id: post.id,
      body: post.body,
      image_url: post.image_url,
      feeling: post.feeling,
      feeling_text: post.feeling_text,
      created_at: post.created_at,
      author: author(post.client_id),
      likes: post.post_likes.length,
      liked_by_me: me ? post.post_likes.some((l) => l.client_id === me) : false,
      // Who liked it. Anyone without a saved profile is dropped rather than
      // listed as "someone", since a tooltip of anonymous entries says less
      // than the count already does.
      liked_by: post.post_likes.map((l) => likerName(l.client_id)).filter(Boolean),
      mine: me ? post.client_id === me : false,
      comments: post.post_comments
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map((comment) => ({
          id: comment.id,
          body: comment.body,
          created_at: comment.created_at,
          author: author(comment.client_id),
          mine: me ? comment.client_id === me : false,
        })),
    })),
  )
})

// ---------------------------------------------------------------------------
// POST /api/feed — { client_id, body, image } → created post
// ---------------------------------------------------------------------------
feedRouter.post('/', postLimit, jsonWithImage, async (req, res) => {
  const { client_id: rawClientId, body, image, feeling, feeling_text: feelingText } = req.body ?? {}

  const clientId = readClientId(rawClientId)
  if (!clientId) return res.status(400).json({ error: 'client_id must be a uuid' })

  const text = typeof body === 'string' ? body.trim() : ''
  if (text.length > MAX_BODY) {
    return res.status(400).json({ error: `post must be ${MAX_BODY} characters or fewer` })
  }

  const mood = readFeeling(feeling)
  if (mood.error) return res.status(400).json({ error: mood.error })

  const moodText = readFeelingText(feelingText)
  if (moodText.error) return res.status(400).json({ error: moodText.error })

  // Checked against the cleaned values: "   " as a feeling is absence, not
  // content, and letting it through would hit the database constraint instead.
  if (!text && !image && !mood.value && !moodText.value) {
    return res.status(400).json({ error: 'a post needs some text, a picture or a feeling' })
  }

  let imageUrl = null
  if (image) {
    const upload = await uploadDataUrl(image, 'posts')
    if (upload.error) return res.status(400).json({ error: upload.error })
    imageUrl = upload.url
  }

  const { data, error } = await supabase
    .from('posts')
    .insert({
      client_id: clientId,
      body: text,
      image_url: imageUrl,
      feeling: mood.value,
      feeling_text: moodText.value,
    })
    .select()
    .single()

  if (error) {
    // The row was rejected, so nothing references the upload any more.
    if (imageUrl) await removeByUrl(imageUrl)
    return res.status(500).json({ error: dbError(error) })
  }

  // Broadcast: a new post is news to everybody.
  await recordEvent({ kind: 'post', actor: clientId, postId: data.id, snippet: text })

  res.status(201).json({
    ...data,
    likes: 0,
    liked_by_me: false,
    liked_by: [],
    mine: true,
    comments: [],
    // The client already knows who it is; it fills the author in locally.
  })
})

// ---------------------------------------------------------------------------
// DELETE /api/feed/:id — your own post, or anything with the board passphrase
// ---------------------------------------------------------------------------
// Your own, and nothing else.
//
// The board passphrase used to grant this as a moderation escape hatch. It no
// longer does: unlocking the board governs pinning to the two lists, and
// nothing about it should let one person remove another's writing from the
// feed. There is deliberately no override — if something has to come off the
// timeline, it comes off in the database.
function canRemove(req, row) {
  const claimed = readClientId(req.get('x-client-id'))
  return claimed !== null && claimed === row.client_id
}

feedRouter.delete('/:id', async (req, res) => {
  const { data: post, error } = await supabase
    .from('posts')
    .select('id, client_id, image_url')
    .eq('id', req.params.id)
    .maybeSingle()

  if (isBadUuid(error)) return res.status(404).json({ error: 'post not found' })
  if (error) return res.status(500).json({ error: dbError(error) })
  if (!post) return res.status(404).json({ error: 'post not found' })

  if (!canRemove(req, post)) {
    return res.status(403).json({ error: 'That is not your post.' })
  }

  const { error: deleteError } = await supabase.from('posts').delete().eq('id', post.id)
  if (deleteError) return res.status(500).json({ error: dbError(deleteError) })

  // Likes and comments go with it via ON DELETE CASCADE.
  await removeByUrl(post.image_url)
  res.status(204).end()
})

// ---------------------------------------------------------------------------
// POST /api/feed/:id/like — toggle
// ---------------------------------------------------------------------------
feedRouter.post('/:id/like', likeLimit, async (req, res) => {
  const clientId = readClientId(req.body?.client_id)
  if (!clientId) return res.status(400).json({ error: 'client_id must be a uuid' })

  const { data: existing, error: readError } = await supabase
    .from('post_likes')
    .select('post_id')
    .eq('post_id', req.params.id)
    .eq('client_id', clientId)
    .maybeSingle()

  if (isBadUuid(readError)) return res.status(404).json({ error: 'post not found' })
  if (readError) return res.status(500).json({ error: dbError(readError) })

  // Needed to address the notification at whoever owns the post.
  const { data: likedPost } = await supabase
    .from('posts')
    .select('client_id, body')
    .eq('id', req.params.id)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('post_likes')
      .delete()
      .eq('post_id', req.params.id)
      .eq('client_id', clientId)
    if (error) return res.status(500).json({ error: dbError(error) })
  } else {
    const { error } = await supabase
      .from('post_likes')
      .insert({ post_id: req.params.id, client_id: clientId })
    // 23503 = no such post; 23505 = already liked, which a double-tap can
    // produce and which we can treat as success since the state is right.
    if (error && error.code === '23503') {
      return res.status(404).json({ error: 'post not found' })
    }
    if (error && error.code !== '23505') {
      return res.status(500).json({ error: dbError(error) })
    }
  }

  // Return the authoritative count rather than trusting the client to add one.
  const { count, error: countError } = await supabase
    .from('post_likes')
    .select('*', { count: 'exact', head: true })
    .eq('post_id', req.params.id)

  if (countError) return res.status(500).json({ error: dbError(countError) })

  // Only on the way up, and never for liking your own post. Unliking is not
  // an event — nobody wants to be told their like was taken back.
  if (!existing && likedPost && likedPost.client_id !== clientId) {
    await recordEvent({
      kind: 'like',
      actor: clientId,
      target: likedPost.client_id,
      postId: req.params.id,
      snippet: likedPost.body,
    })
  }

  res.json({ likes: count ?? 0, liked_by_me: !existing })
})

// ---------------------------------------------------------------------------
// POST /api/feed/:id/comments — { client_id, body }
// ---------------------------------------------------------------------------
feedRouter.post('/:id/comments', commentLimit, async (req, res) => {
  const clientId = readClientId(req.body?.client_id)
  if (!clientId) return res.status(400).json({ error: 'client_id must be a uuid' })

  const text = typeof req.body?.body === 'string' ? req.body.body.trim() : ''
  if (!text) return res.status(400).json({ error: 'comment is required' })
  if (text.length > MAX_COMMENT) {
    return res.status(400).json({ error: `comment must be ${MAX_COMMENT} characters or fewer` })
  }

  const { data, error } = await supabase
    .from('post_comments')
    .insert({ post_id: req.params.id, client_id: clientId, body: text })
    .select()
    .single()

  if (error?.code === '23503' || isBadUuid(error)) {
    return res.status(404).json({ error: 'post not found' })
  }
  if (error) return res.status(500).json({ error: dbError(error) })

  const { data: commentedPost } = await supabase
    .from('posts')
    .select('client_id')
    .eq('id', req.params.id)
    .maybeSingle()

  if (commentedPost && commentedPost.client_id !== clientId) {
    await recordEvent({
      kind: 'comment',
      actor: clientId,
      target: commentedPost.client_id,
      postId: req.params.id,
      snippet: text,
    })
  }

  res.status(201).json({ ...data, mine: true })
})

// DELETE /api/feed/:id/comments/:commentId — your own, or board passphrase.
feedRouter.delete('/:id/comments/:commentId', async (req, res) => {
  const { data: comment, error } = await supabase
    .from('post_comments')
    .select('id, client_id')
    .eq('id', req.params.commentId)
    .maybeSingle()

  if (isBadUuid(error)) return res.status(404).json({ error: 'comment not found' })
  if (error) return res.status(500).json({ error: dbError(error) })
  if (!comment) return res.status(404).json({ error: 'comment not found' })

  if (!canRemove(req, comment)) {
    return res.status(403).json({ error: 'That is not your comment.' })
  }

  const { error: deleteError } = await supabase
    .from('post_comments')
    .delete()
    .eq('id', comment.id)

  if (deleteError) return res.status(500).json({ error: dbError(deleteError) })
  res.status(204).end()
})
