import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import express from 'express'
import cors from 'cors'
import { supabase } from './supabase.js'
import {
  adminEnabled,
  requireAuth,
  requireAuthForReads,
  requireStreakAuth,
  streakUsesDefaultPassword,
} from './auth.js'
import { dbError } from './dbError.js'
import { eventsRouter } from './events.js'
import { feedRouter } from './feed.js'
import { profileRouter } from './profiles.js'
import { visitsRouter, adminRouter } from './visits.js'

const app = express()

// The brute-force throttle keys on req.ip, so behind a reverse proxy Express
// must be told to read X-Forwarded-For — otherwise every request looks like it
// came from the proxy and one bad guesser locks out everybody. Set
// TRUST_PROXY=1 (hops) or a subnet when deploying behind one.
if (process.env.TRUST_PROXY) {
  const value = Number(process.env.TRUST_PROXY)
  app.set('trust proxy', Number.isNaN(value) ? process.env.TRUST_PROXY : value)
}

app.use(cors())

// Deliberately small. The two routes that accept an uploaded image install
// their own 9MB parser, so a large body can only be aimed where one is
// expected rather than at every endpoint on the server.
app.use(express.json({ limit: '128kb' }))

const LISTS = ['worth', 'worst']
const MAX_TEXT = 200 // matches the client's input maxLength
const MAX_AUTHOR = 40 // matches the client's name-prompt maxLength

// POST and PATCH accept the same text, so the rules live in one place.
function textError(text) {
  if (typeof text !== 'string' || !text.trim()) return 'text is required'
  if (text.trim().length > MAX_TEXT) return `text must be ${MAX_TEXT} characters or fewer`
  return null
}

// Who pinned it. Optional at the API level even though the UI always asks:
// old clients and curl should still work, and a missing name is stored as NULL
// rather than an empty string so "no author" is one value, not two.
function readAuthor(author) {
  if (author === undefined || author === null) return { value: null }
  if (typeof author !== 'string') return { error: 'author must be text' }
  const trimmed = author.trim()
  if (!trimmed) return { value: null }
  if (trimmed.length > MAX_AUTHOR) {
    return { error: `author must be ${MAX_AUTHOR} characters or fewer` }
  }
  return { value: trimmed }
}

// Postgres rejects a malformed uuid outright; that's a bad path, not a server
// fault, so report it as a miss rather than a 500.
const isBadUuid = (error) => error?.code === '22P02'

// Health check — handy for deploys / uptime pings. Deliberately unauthenticated
// so uptime pingers don't need the passphrase; it reveals nothing.
app.get('/api/health', (req, res) => res.json({ ok: true }))

// Passphrase checks for the client's unlock boxes: 200 if the credential is
// good, 401 if not. Nothing to create or destroy — no server-side session, the
// client just learns whether the passphrase it holds is worth keeping.
app.post('/api/session', requireAuth, (req, res) => res.json({ ok: true }))
app.post('/api/streak/session', requireStreakAuth, (req, res) => res.json({ ok: true }))

const readGuards = requireAuthForReads ? [requireAuth] : []

// ============================================================
// feed, profiles, visit log
// ============================================================
// Mounted before the entries routes purely for readability; Express matches on
// path, so the order between these is not significant.
app.use('/api/feed', feedRouter)
app.use('/api/events', eventsRouter)
app.use('/api/profile', profileRouter)
app.use('/api/visit', visitsRouter)
app.use('/api/admin', adminRouter)

// ============================================================
// entries
// ============================================================

// GET /api/entries — all entries, oldest first. Public unless
// REQUIRE_AUTH_FOR_READS=true.
app.get('/api/entries', ...readGuards, async (req, res) => {
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// POST /api/entries — { text, list, author } → created row. Requires the
// passphrase. The author is whatever name the browser is carrying; it is a
// signature, not an identity claim, since anyone can type anything.
app.post('/api/entries', requireAuth, async (req, res) => {
  const { text, list, author } = req.body ?? {}

  const invalid = textError(text)
  if (invalid) return res.status(400).json({ error: invalid })
  if (!LISTS.includes(list)) {
    return res.status(400).json({ error: `list must be one of: ${LISTS.join(', ')}` })
  }

  const name = readAuthor(author)
  if (name.error) return res.status(400).json({ error: name.error })

  const { data, error } = await supabase
    .from('entries')
    .insert({ text: text.trim(), list, author: name.value })
    .select()
    .single()

  if (error) return res.status(500).json({ error: dbError(error) })
  res.status(201).json(data)
})

// PATCH /api/entries/:id — { text?, author? } → updated row. Requires the
// passphrase. Both fields are optional and only the ones present are written,
// so the client can rename an entry, re-sign it, or do both in one request.
// Sending `author: null` (or "") clears the byline.
//
// The author is editable because the board has entries that predate the
// column and need signing after the fact. Moving an entry between lists is
// still a different gesture than renaming it, and nothing asks for it yet.
app.patch('/api/entries/:id', requireAuth, async (req, res) => {
  const body = req.body ?? {}
  const patch = {}

  // `in` rather than a truthiness check: omitting a field must leave it alone,
  // which is not the same as sending an empty one to clear it.
  if ('text' in body) {
    const invalid = textError(body.text)
    if (invalid) return res.status(400).json({ error: invalid })
    patch.text = body.text.trim()
  }

  if ('author' in body) {
    const name = readAuthor(body.author)
    if (name.error) return res.status(400).json({ error: name.error })
    patch.author = name.value
  }

  if (Object.keys(patch).length === 0) {
    return res.status(400).json({ error: 'nothing to update: send text and/or author' })
  }

  const { data, error } = await supabase
    .from('entries')
    .update(patch)
    .eq('id', req.params.id)
    .select()
    .maybeSingle() // no row => data is null rather than an error, so 404 is easy

  if (isBadUuid(error)) return res.status(404).json({ error: 'entry not found' })
  if (error) return res.status(500).json({ error: error.message })
  if (!data) return res.status(404).json({ error: 'entry not found' })
  res.json(data)
})

// DELETE /api/entries/:id — requires the passphrase.
app.delete('/api/entries/:id', requireAuth, async (req, res) => {
  const { error } = await supabase.from('entries').delete().eq('id', req.params.id)
  if (isBadUuid(error)) return res.status(404).json({ error: 'entry not found' })
  if (error) return res.status(500).json({ error: error.message })
  res.status(204).end()
})

// ============================================================
// streak — the no-contact day counter
// ============================================================
// "One check-in per day" has to mean one per *her* day, so the browser sends
// its own local calendar date and the server stores that verbatim. Deriving
// the date server-side would use UTC, which rolls over at the wrong moment for
// everyone outside it: an evening check-in could land on tomorrow's date and
// burn two days at once.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const DAY_MS = 86_400_000

// The client is trusted for the timezone, not for the calendar: without this,
// posting today=2099-01-01 would let one request stake out every future day.
// Real timezones span UTC-12..UTC+14, so a legitimate local date is never more
// than one day away from the UTC one.
function localDateError(today) {
  if (typeof today !== 'string' || !DATE_RE.test(today)) {
    return 'today must be a YYYY-MM-DD date'
  }
  const given = Date.parse(`${today}T00:00:00Z`)
  if (Number.isNaN(given)) return 'today is not a real date'
  // V8 quietly rolls an out-of-range day over rather than rejecting it —
  // 2026-02-31 parses as 3 March — so confirm it round-trips unchanged.
  if (new Date(given).toISOString().slice(0, 10) !== today) {
    return 'today is not a real date'
  }

  const now = new Date()
  const utcToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  if (Math.abs(given - utcToday) > DAY_MS) return 'today is too far from the server date'
  return null
}

// The single row is created by supabase.sql, but a database that missed the
// migration shouldn't 500 the whole board — report it as a real error instead.
async function readStreak() {
  const { data, error } = await supabase.from('streak').select('*').eq('id', 1).maybeSingle()
  if (error) return { error: dbError(error) }
  if (!data) return { error: 'streak row missing — run migrations/002_authors_and_streak.sql' }
  return { data }
}

// GET /api/streak — public alongside the board itself.
app.get('/api/streak', ...readGuards, async (req, res) => {
  const { data, error } = await readStreak()
  if (error) return res.status(500).json({ error })
  res.json(data)
})

// POST /api/streak/check-in — { today } → one more clean day.
app.post('/api/streak/check-in', requireStreakAuth, async (req, res) => {
  const { today } = req.body ?? {}
  const invalid = localDateError(today)
  if (invalid) return res.status(400).json({ error: invalid })

  const { data: current, error } = await readStreak()
  if (error) return res.status(500).json({ error })

  if (current.last_check_in === today) {
    return res.status(409).json({ error: 'Already counted today. Come back tomorrow.' })
  }

  const count = current.count + 1

  // Compare-and-swap on last_check_in: two taps that race (double-click, or the
  // same phone on a flaky connection retrying) would otherwise both read the
  // old count and award two days for one. The second update matches no row.
  const query = supabase
    .from('streak')
    .update({
      count,
      best: Math.max(current.best, count),
      last_check_in: today,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1)

  const guarded =
    current.last_check_in === null
      ? query.is('last_check_in', null)
      : query.eq('last_check_in', current.last_check_in)

  const { data, error: writeError } = await guarded.select().maybeSingle()
  if (writeError) return res.status(500).json({ error: dbError(writeError) })
  if (!data) {
    return res.status(409).json({ error: 'Already counted today. Come back tomorrow.' })
  }
  res.json(data)
})

// POST /api/streak/reset — { today } → back to zero.
// `best` survives on purpose: losing the streak shouldn't erase the record of
// how far it got. Always allowed, including on a day already checked in —
// changing your mind about today is exactly when you'd need it.
app.post('/api/streak/reset', requireStreakAuth, async (req, res) => {
  const { today } = req.body ?? {}
  const invalid = localDateError(today)
  if (invalid) return res.status(400).json({ error: invalid })

  const { data, error } = await supabase
    .from('streak')
    .update({ count: 0, last_check_in: today, updated_at: new Date().toISOString() })
    .eq('id', 1)
    .select()
    .maybeSingle()

  if (error) return res.status(500).json({ error: dbError(error) })
  if (!data) {
    return res
      .status(500)
      .json({ error: 'streak row missing — run migrations/002_authors_and_streak.sql' })
  }
  res.json(data)
})

// --- serve the built client, if it's there ----------------------------------
// In production one process serves both the API and the static bundle, so the
// whole board is a single deploy on a single origin: no CORS, and
// VITE_API_BASE can stay blank because /api is same-origin. In development
// this directory doesn't exist yet and Vite serves the client instead.
const clientDist = path.resolve(import.meta.dirname, '../client/dist')

if (fs.existsSync(path.join(clientDist, 'index.html'))) {
  app.use(express.static(clientDist))

  // SPA fallback — anything that isn't /api and isn't a real file is the app.
  // Express 5 dropped string wildcards, hence the regex.
  app.get(/^(?!\/api\/).*/, (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'))
  })
  console.log('[kawaii-board] serving client from client/dist')
} else {
  console.log('[kawaii-board] no client build found — run `npm run build` (dev uses Vite)')
}

const port = process.env.PORT || 3001
app.listen(port, () => {
  console.log(`[kawaii-board] API listening on http://localhost:${port}`)
  console.log(
    `[kawaii-board] auth: writes locked, reads ${requireAuthForReads ? 'locked' : 'public'}`,
  )
  console.log(
    `[kawaii-board] feed: open to anyone · visit log: ${adminEnabled ? 'on' : 'OFF (set ADMIN_PASSWORD)'}`,
  )
  if (streakUsesDefaultPassword) {
    console.warn(
      '[kawaii-board] STREAK_PASSWORD is unset — using the default from server/auth.js, ' +
        'which is public. Set STREAK_PASSWORD to something private for a real deploy.',
    )
  }
})
