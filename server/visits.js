import express from 'express'
import { supabase } from './supabase.js'
import { dbError } from './dbError.js'
import { requireAdmin } from './auth.js'
import { rateLimit } from './rateLimit.js'

// The access log.
//
// Recorded from a beacon the client fires on load rather than from a
// middleware on the HTML response, for two reasons: it works identically
// behind Vite in development (where Express never serves the page), and the
// browser can say who it thinks it is, which the server cannot infer. The
// trade is that a visitor with JavaScript off leaves no trace — which also
// means the log is mostly real people rather than crawlers.
export const visitsRouter = express.Router()
export const adminRouter = express.Router()

// Refreshing shouldn't write a row per keystroke of F5.
const DEDUPE_MS = 60_000
const recent = new Map() // "ip|client" -> expires

function seenRecently(key, now) {
  const expires = recent.get(key)
  if (expires && expires > now) return true
  recent.set(key, now + DEDUPE_MS)
  if (recent.size > 5000) {
    for (const [k, exp] of recent) if (exp <= now) recent.delete(k)
  }
  return false
}

// An IPv4 client reaching a server listening on IPv6 arrives as an
// IPv4-mapped address: 127.0.0.1 shows up as ::ffff:127.0.0.1. Strip the
// prefix, mostly because the same visitor can otherwise be recorded both ways
// on different requests and be counted twice in the unique-IP tally.
function normalizeIp(ip) {
  if (typeof ip !== 'string') return null
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(ip)
  return mapped ? mapped[1] : ip
}

// Who to write in the log.
//
// Deliberately NOT req.ip, and not req.ips either.
//
// With `trust proxy` set to a hop count, Express counts from the right of
// X-Forwarded-For and returns the first address outside the trusted hops —
// correct for rate limiting, but it yields an intermediate proxy whenever more
// hops sit in front than the count allows. req.ips is no help: on Express 5 it
// reports only the addresses *inside* the trust boundary, so for
// "203.0.113.42, 10.0.0.1" with trust=1 it returns ["10.0.0.1"] and the real
// client never appears at all. Both verified against a live server, not
// assumed from the docs.
//
// This app runs behind Render, which is itself behind Cloudflare, so the hop
// count isn't something we can pin down. For "who visited", the leftmost entry
// is the original client, so read the header directly.
//
// The cost: a caller can put anything in that header and poison its own log
// line. Accepted here and nowhere else — the passphrase throttle in auth.js
// and the rate limiters still key on req.ip, so a forged header can't slip
// past a limit, only lie in a log nobody is billing on. And the header is
// ignored entirely unless the app has been told a proxy is in front.
function clientIp(req) {
  if (req.app.get('trust proxy')) {
    const first = req.get('x-forwarded-for')?.split(',')[0]?.trim()
    if (first) return normalizeIp(first)
  }
  return normalizeIp(req.ip)
}

const clip = (value, max) =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// POST /api/visit — fire and forget. Always 204, even on failure: a broken log
// must never be something the visitor can notice, let alone be blocked by.
visitsRouter.post(
  '/',
  rateLimit({ name: 'visit', max: 60, windowMs: 10 * 60 * 1000 }),
  async (req, res) => {
    res.status(204).end()

    const now = Date.now()
    const ip = clientIp(req)
    const { client_id: clientId, name, path } = req.body ?? {}

    if (seenRecently(`${ip}|${clientId ?? ''}`, now)) return

    await supabase.from('visits').insert({
      ip,
      user_agent: clip(req.get('user-agent'), 400),
      path: clip(path, 300),
      referrer: clip(req.get('referer'), 400),
      client_id: UUID.test(clientId ?? '') ? clientId : null,
      name: clip(name, 40),
    })
    // No error handling on purpose — the response is already sent, and a
    // failed log line is not worth a crashed request.
  },
)

// Reads the log and works out who each row belongs to.
//
// A visit is recorded the moment a page loads, which is before anyone has had
// the chance to type a name — so the first row for a new browser always has
// `name` empty, and only later visits carry it. That used to leave the log
// full of anonymous first-contacts that were, in fact, attributable.
//
// The fix is that the beacon always sends a `client_id` (minted on first use,
// before the prompt is even shown), so the row is already linked to a browser.
// Resolving names from `profiles` at read time rather than trusting what was
// captured at the time means a name set *later* retroactively labels every
// earlier visit from that browser — and a rename relabels them all again,
// which storing a copy on each row would not.
async function loadVisits(limit) {
  const { data, error } = await supabase
    .from('visits')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return { error: dbError(error) }

  const ids = [...new Set(data.map((row) => row.client_id).filter(Boolean))]
  const names = new Map()

  if (ids.length) {
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('client_id, name')
      .in('client_id', ids)

    if (profileError) return { error: dbError(profileError) }
    for (const profile of profiles) names.set(profile.client_id, profile.name)
  }

  return {
    data: data.map((row) => ({
      ...row,
      // Best known name for this browser. `logged_name` keeps whatever the
      // beacon actually sent, so the difference stays visible rather than
      // being quietly rewritten.
      name: names.get(row.client_id) ?? row.name ?? null,
      logged_name: row.name ?? null,
      named_later: Boolean(!row.name && names.get(row.client_id)),
    })),
  }
}

// GET /api/admin/visits — newest first.
adminRouter.get('/visits', requireAdmin, async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 500, 2000)

  const { data, error } = await loadVisits(limit)
  if (error) return res.status(500).json({ error })

  // A little summary, since "who keeps coming back" is the actual question.
  const byIp = new Map()
  for (const row of data) {
    const key = row.ip ?? 'unknown'
    const seen = byIp.get(key) ?? { ip: key, visits: 0, names: new Set(), last: row.created_at }
    seen.visits += 1
    if (row.name) seen.names.add(row.name)
    byIp.set(key, seen)
  }

  res.json({
    total: data.length,
    unique_ips: byIp.size,
    // How many rows are still anonymous: a browser that has never saved a
    // name. That number, not a blank column, is the honest answer to "who
    // visited" for people who only ever looked.
    unnamed: data.filter((row) => !row.name).length,
    top: [...byIp.values()]
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 20)
      .map((s) => ({ ip: s.ip, visits: s.visits, names: [...s.names], last: s.last })),
    visits: data,
  })
})

// GET /api/admin/visits.log — the same thing as a plain text log file, so it
// can be read in a browser tab or piped straight to disk with curl.
adminRouter.get('/visits.log', requireAdmin, async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 2000, 10_000)

  const { data, error } = await loadVisits(limit)
  if (error) return res.status(500).json({ error })

  const lines = data.map((row) =>
    [
      row.created_at,
      row.ip ?? '-',
      // A trailing * marks a name resolved from the profile rather than sent
      // by the beacon at the time.
      (row.name ?? '-') + (row.named_later ? '*' : ''),
      row.client_id ?? '-',
      row.path ?? '-',
      `ref=${row.referrer ?? '-'}`,
      `ua="${(row.user_agent ?? '-').replace(/"/g, "'")}"`,
    ].join(' '),
  )

  res.type('text/plain').send(
    `# kawaii-board visit log — ${data.length} most recent, newest first\n` +
      `# generated ${new Date().toISOString()}\n` +
      `# when ip name client_id path referrer user_agent\n` +
      lines.join('\n') +
      '\n',
  )
})
