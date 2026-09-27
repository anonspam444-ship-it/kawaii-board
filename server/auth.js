import crypto from 'node:crypto'

// Shared-passphrase auth. There are no user accounts on this board — a
// passphrase is held here in the server env and typed by whoever is pinning
// things. It is never baked into the client bundle (a VITE_* value would be
// readable by anyone who views source, which is obscurity rather than auth).
//
// There are three independent credentials:
//   BOARD_PASSWORD   pinning/nailing/editing entries
//   STREAK_PASSWORD  the no-contact counter, which belongs to one person
//   ADMIN_PASSWORD   the visit log — the owner only
// They are deliberately separate: everyone with the board passphrase should
// not thereby be able to reset somebody else's streak, and neither of those
// should expose who has been visiting the site.

const boardPassword = process.env.BOARD_PASSWORD

if (!boardPassword) {
  console.error(
    '\n[kawaii-board] Missing BOARD_PASSWORD.\n' +
      'The write API refuses to start without it, so a deploy can never end up\n' +
      'with open POST/DELETE routes by accident. Set it in server/.env:\n\n' +
      '  BOARD_PASSWORD=$(openssl rand -base64 24)\n',
  )
  process.exit(1)
}

if (boardPassword.length < 12) {
  console.warn(
    '[kawaii-board] BOARD_PASSWORD is shorter than 12 characters. ' +
      'Consider `openssl rand -base64 24`.',
  )
}

// The streak counter has a default on purpose: it is a personal toy for one
// person, and she was given this passphrase directly. Unlike BOARD_PASSWORD
// there is no hard failure without it — but the default is public (it is in
// this file, in a public repo), so a real deploy should override it.
const STREAK_DEFAULT = 'barkdog69'
const streakPassword = process.env.STREAK_PASSWORD || STREAK_DEFAULT

// The visit log gets no default at all. Unlike the streak, guessing this one
// exposes other people's data, so an unset value disables the endpoints
// outright rather than falling back to something publishable.
const adminPassword = process.env.ADMIN_PASSWORD || null
export const adminEnabled = Boolean(adminPassword)

if (adminPassword && adminPassword.length < 12) {
  console.warn(
    '[kawaii-board] ADMIN_PASSWORD is shorter than 12 characters. ' +
      'It guards visitor IPs — consider `openssl rand -base64 24`.',
  )
}

// --- brute-force throttle ---------------------------------------------------
// A single guessable passphrase with unlimited attempts is weak, so failures
// are counted per IP, per realm — a wrong streak guess must not lock someone
// out of pinning entries. In-memory and therefore per-process: it resets on
// restart and doesn't coordinate across replicas, which is the right trade for
// a board this size. Put a real limiter in front if this ever gets popular.
const WINDOW_MS = 15 * 60 * 1000
const MAX_FAILURES = 10
const failures = new Map() // "realm|ip" -> { count, expires }

function sweep(now) {
  for (const [key, record] of failures) {
    if (record.expires <= now) failures.delete(key)
  }
}

function throttled(key, now) {
  const record = failures.get(key)
  if (!record || record.expires <= now) return 0
  return record.count >= MAX_FAILURES ? Math.ceil((record.expires - now) / 1000) : 0
}

function recordFailure(key, now) {
  const record = failures.get(key)
  if (!record || record.expires <= now) {
    failures.set(key, { count: 1, expires: now + WINDOW_MS })
  } else {
    record.count += 1
  }
  if (failures.size > 1000) sweep(now)
}

// Compare fixed-length digests: timingSafeEqual throws on length mismatch, and
// hashing first keeps the comparison constant-time regardless of input length.
function digestMatcher(password) {
  const expected = crypto.createHash('sha256').update(password).digest()
  return (given) =>
    crypto.timingSafeEqual(expected, crypto.createHash('sha256').update(given).digest())
}

// --- guard factory ----------------------------------------------------------
// `readCredential` pulls the secret out of the request; each realm uses its own
// header so a browser holding both can send both at once without them fighting
// over Authorization.
function makeGuard({ realm, password, readCredential, challenge, missing, wrong }) {
  const matches = digestMatcher(password)

  return function guard(req, res, next) {
    const now = Date.now()
    const key = `${realm}|${req.ip ?? 'unknown'}`

    const retryAfter = throttled(key, now)
    if (retryAfter) {
      res.set('Retry-After', String(retryAfter))
      return res.status(429).json({ error: 'Too many failed attempts. Try again later.' })
    }

    const token = readCredential(req)
    if (token && matches(token)) return next()

    // Only wrong guesses count against the limit; a missing header is just an
    // un-unlocked browser asking politely.
    if (token) recordFailure(key, now)

    // Only the bearer realm advertises a challenge; X-Streak-Key is not an
    // HTTP auth scheme, and claiming it is would invite a browser login box
    // that can't produce the right header.
    if (challenge) res.set('WWW-Authenticate', challenge)
    res.status(401).json({ error: token ? wrong : missing })
  }
}

function bearer(req) {
  const match = /^Bearer\s+(.+)$/i.exec((req.get('authorization') ?? '').trim())
  return match ? match[1] : null
}

export const requireAuth = makeGuard({
  realm: 'board',
  password: boardPassword,
  readCredential: bearer,
  challenge: 'Bearer realm="kawaii-board"',
  missing: 'Passphrase required.',
  wrong: 'Wrong passphrase.',
})

export const requireStreakAuth = makeGuard({
  realm: 'streak',
  password: streakPassword,
  readCredential: (req) => (req.get('x-streak-key') ?? '').trim() || null,
  missing: 'Streak passphrase required.',
  wrong: "That's not the passphrase.",
})

// The visit log. When ADMIN_PASSWORD is unset this refuses everything with a
// 503 rather than a 401, because there is no passphrase that would work and
// pretending otherwise just invites guessing.
export const requireAdmin = adminEnabled
  ? makeGuard({
      realm: 'admin',
      password: adminPassword,
      readCredential: (req) => (req.get('x-admin-key') ?? '').trim() || null,
      missing: 'Admin key required.',
      wrong: 'Wrong admin key.',
    })
  : (req, res) =>
      res.status(503).json({
        error: 'The visit log is disabled — set ADMIN_PASSWORD on the server to turn it on.',
      })

// A plain predicate for the board passphrase, for the places that need to ask
// "is this request privileged?" as part of a larger decision rather than
// rejecting outright — the feed lets you delete your own post OR anything at
// all with the board passphrase, and that's one branch, not two middlewares.
// Deliberately does not touch the failure throttle: an unprivileged caller
// deleting their own post is the normal path, not a failed guess.
const boardMatches = digestMatcher(boardPassword)

export function hasBoardPassword(req) {
  const token = bearer(req)
  return Boolean(token && boardMatches(token))
}

// True when the streak is still using the passphrase baked into this file.
// Only used for a startup warning — never sent to the client.
export const streakUsesDefaultPassword = streakPassword === STREAK_DEFAULT

// Reads are public by default: the board stays viewable by anyone with the URL,
// while pinning and removing require the passphrase. Set
// REQUIRE_AUTH_FOR_READS=true to make the whole board private.
export const requireAuthForReads = process.env.REQUIRE_AUTH_FOR_READS === 'true'
