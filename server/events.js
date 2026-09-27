import express from 'express'
import { supabase } from './supabase.js'
import { dbError } from './dbError.js'

// Notifications.
//
// The client keeps a cursor (the highest event id it has shown) in
// localStorage and asks for anything newer. So "already open" and "next time
// they load" are the same code path, and the server holds no per-viewer state.
export const eventsRouter = express.Router()

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Enough to fill a toast stack; anything older is stale news by the time it
// would be shown.
const MAX_EVENTS = 25

// GET /api/events?client_id=&since=
//
// Omitting `since` returns no events, only the current high-water mark. That's
// deliberate: a brand-new browser should not open to a burst of toasts about
// things that happened before it existed. It stores the mark and starts from
// there.
eventsRouter.get('/', async (req, res) => {
  const clientId = UUID.test(req.query.client_id ?? '') ? req.query.client_id : null

  const { data: newest, error: headError } = await supabase
    .from('events')
    .select('id')
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (headError) return res.status(500).json({ error: dbError(headError) })

  const latestId = newest?.id ?? 0
  const since = Number(req.query.since)

  // No cursor, no identity, or nothing new: just report where the end is.
  if (!clientId || !Number.isFinite(since) || since < 0 || since >= latestId) {
    return res.json({ latest_id: latestId, events: [] })
  }

  const { data, error } = await supabase
    .from('events')
    .select('id, kind, actor_client_id, target_client_id, post_id, snippet, created_at')
    // Broadcasts plus anything addressed to this browser.
    .or(`target_client_id.is.null,target_client_id.eq.${clientId}`)
    // Your own actions are not news to you.
    .neq('actor_client_id', clientId)
    .gt('id', since)
    .order('id', { ascending: false })
    .limit(MAX_EVENTS)

  if (error) return res.status(500).json({ error: dbError(error) })

  const actorIds = [...new Set(data.map((e) => e.actor_client_id))]
  const actors = new Map()

  if (actorIds.length) {
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('client_id, name, avatar_url')
      .in('client_id', actorIds)

    if (profileError) return res.status(500).json({ error: dbError(profileError) })
    for (const p of profiles) actors.set(p.client_id, p)
  }

  res.json({
    latest_id: latestId,
    // Oldest first, so the toast stack reads in the order things happened.
    events: data.reverse().map((event) => {
      const actor = actors.get(event.actor_client_id)
      return {
        id: event.id,
        kind: event.kind,
        snippet: event.snippet,
        created_at: event.created_at,
        // Never the client_id — that value is the delete credential, and this
        // endpoint is reachable by anyone.
        actor: { name: actor?.name ?? null, avatar_url: actor?.avatar_url ?? null },
        // True when it's about something of yours rather than a broadcast.
        mine: event.target_client_id === clientId,
      }
    }),
  })
})

// Called from the feed routes after a successful write.
//
// Never throws and never blocks: a notification that fails to record must not
// turn a successful post into an error for the person who wrote it.
export async function recordEvent({ kind, actor, target = null, postId = null, snippet = null }) {
  try {
    await supabase.from('events').insert({
      kind,
      actor_client_id: actor,
      target_client_id: target,
      post_id: postId,
      snippet: snippet ? snippet.slice(0, 120) : null,
    })
  } catch {
    // Deliberately swallowed.
  }
}
