import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import express from 'express'
import cors from 'cors'
import { supabase } from './supabase.js'
import { requireAuth, requireAuthForReads } from './auth.js'

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
app.use(express.json())

const LISTS = ['worth', 'worst']
const MAX_TEXT = 200 // matches the client's input maxLength

// Health check — handy for deploys / uptime pings. Deliberately unauthenticated
// so uptime pingers don't need the passphrase; it reveals nothing.
app.get('/api/health', (req, res) => res.json({ ok: true }))

// Passphrase check for the client's unlock box: 200 if the bearer token is
// good, 401 if not. Nothing to create or destroy — no server-side session, the
// client just learns whether the passphrase it holds is worth keeping.
app.post('/api/session', requireAuth, (req, res) => res.json({ ok: true }))

// GET /api/entries — all entries, oldest first. Public unless
// REQUIRE_AUTH_FOR_READS=true.
const readGuards = requireAuthForReads ? [requireAuth] : []
app.get('/api/entries', ...readGuards, async (req, res) => {
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// POST /api/entries — { text, list } → created row. Requires the passphrase.
app.post('/api/entries', requireAuth, async (req, res) => {
  const { text, list } = req.body ?? {}

  if (typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'text is required' })
  }
  if (text.trim().length > MAX_TEXT) {
    return res.status(400).json({ error: `text must be ${MAX_TEXT} characters or fewer` })
  }
  if (!LISTS.includes(list)) {
    return res.status(400).json({ error: `list must be one of: ${LISTS.join(', ')}` })
  }

  const { data, error } = await supabase
    .from('entries')
    .insert({ text: text.trim(), list })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json(data)
})

// DELETE /api/entries/:id — requires the passphrase.
app.delete('/api/entries/:id', requireAuth, async (req, res) => {
  const { error } = await supabase.from('entries').delete().eq('id', req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  res.status(204).end()
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
})
