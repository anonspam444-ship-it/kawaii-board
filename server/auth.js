import crypto from 'node:crypto'

// Shared-passphrase auth. There are no user accounts on this board — one
// passphrase, held here in the server env and typed by whoever is pinning
// things. It is never baked into the client bundle (a VITE_* value would be
// readable by anyone who views source, which is obscurity rather than auth).
const password = process.env.BOARD_PASSWORD

if (!password) {
  console.error(
    '\n[kawaii-board] Missing BOARD_PASSWORD.\n' +
      'The write API refuses to start without it, so a deploy can never end up\n' +
      'with open POST/DELETE routes by accident. Set it in server/.env:\n\n' +
      '  BOARD_PASSWORD=$(openssl rand -base64 24)\n',
  )
  process.exit(1)
}

if (password.length < 12) {
  console.warn(
    '[kawaii-board] BOARD_PASSWORD is shorter than 12 characters. ' +
      'Consider `openssl rand -base64 24`.',
  )
}

// Compare fixed-length digests: timingSafeEqual throws on length mismatch, and
// hashing first keeps the comparison constant-time regardless of input length.
const expected = crypto.createHash('sha256').update(password).digest()

function matches(given) {
  const got = crypto.createHash('sha256').update(given).digest()
  return crypto.timingSafeEqual(expected, got)
}

function bearer(req) {
  const match = /^Bearer\s+(.+)$/i.exec((req.get('authorization') ?? '').trim())
  return match ? match[1] : null
}

// --- brute-force throttle ---------------------------------------------------
// A single guessable passphrase with unlimited attempts is weak, so failures
// are counted per IP. In-memory and therefore per-process: it resets on restart
// and doesn't coordinate across replicas, which is the right trade for a board
// this size. Put a real limiter in front if this ever gets popular.
const WINDOW_MS = 15 * 60 * 1000
const MAX_FAILURES = 10
const failures = new Map() // ip -> { count, expires }

function sweep(now) {
  for (const [ip, record] of failures) {
    if (record.expires <= now) failures.delete(ip)
  }
}

function throttled(ip, now) {
  const record = failures.get(ip)
  if (!record || record.expires <= now) return 0
  return record.count >= MAX_FAILURES ? Math.ceil((record.expires - now) / 1000) : 0
}

function recordFailure(ip, now) {
  const record = failures.get(ip)
  if (!record || record.expires <= now) {
    failures.set(ip, { count: 1, expires: now + WINDOW_MS })
  } else {
    record.count += 1
  }
  if (failures.size > 1000) sweep(now)
}

export function requireAuth(req, res, next) {
  const now = Date.now()
  const ip = req.ip ?? 'unknown'

  const retryAfter = throttled(ip, now)
  if (retryAfter) {
    res.set('Retry-After', String(retryAfter))
    return res.status(429).json({ error: 'Too many failed attempts. Try again later.' })
  }

  const token = bearer(req)
  if (token && matches(token)) return next()

  // Only wrong guesses count against the limit; a missing header is just an
  // un-unlocked browser asking politely.
  if (token) recordFailure(ip, now)

  res.set('WWW-Authenticate', 'Bearer realm="kawaii-board"')
  res.status(401).json({ error: token ? 'Wrong passphrase.' : 'Passphrase required.' })
}

// Reads are public by default: the board stays viewable by anyone with the URL,
// while pinning and removing require the passphrase. Set
// REQUIRE_AUTH_FOR_READS=true to make the whole board private.
export const requireAuthForReads = process.env.REQUIRE_AUTH_FOR_READS === 'true'
