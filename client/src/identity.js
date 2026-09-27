// Who you are, as far as this board is concerned.
//
// There is no login. The browser asks for a name once, keeps it in
// localStorage, and sends it along with anything you pin. That makes the byline
// a signature rather than an identity claim — anybody can type any name, and
// clearing site data makes you a stranger again. For a board shared between
// friends that is the right amount of ceremony; a real account system would be
// more machinery than the thing is worth.
//
// localStorage rather than a cookie: the name is only ever read by this app's
// own JavaScript to put in a request body, so there is no reason to attach it
// to every request the browser makes.
const KEY = 'kawaii-board.name'

export const MAX_NAME = 40

function read() {
  try {
    return localStorage.getItem(KEY)
  } catch {
    // Private browsing can throw on access. Falling back to "no name yet" keeps
    // the board usable; the prompt just reappears next time.
    return null
  }
}

let name = read()

export const getName = () => name

export const hasName = () => Boolean(name)

// Returns the stored value so callers can use the cleaned-up version directly.
export function setName(value) {
  name = (value ?? '').trim().slice(0, MAX_NAME) || null
  try {
    if (name) localStorage.setItem(KEY, name)
    else localStorage.removeItem(KEY)
  } catch {
    // Keep it in memory for this session; nothing else we can do.
  }
  return name
}

export const clearName = () => setName(null)

// --- "have we said hello yet?" ---------------------------------------------
// Separate from the name itself so that someone who skips the prompt isn't
// asked again on every page load. Pinning still requires a name — the prompt
// comes back at that point, when it has an obvious reason to.
const GREETED_KEY = 'kawaii-board.greeted'

export function hasBeenGreeted() {
  try {
    return localStorage.getItem(GREETED_KEY) === 'true'
  } catch {
    return false
  }
}

export function markGreeted() {
  try {
    localStorage.setItem(GREETED_KEY, 'true')
  } catch {
    // Non-fatal: worst case the greeting shows again next visit.
  }
}

// --- client id --------------------------------------------------------------
// A random id this browser makes up about itself on first use, and keeps. It
// is what the feed hangs posts, likes and comments off: without something
// stable, "one like per person" and "delete your own post" have nothing to
// key on.
//
// It is not a credential. Anyone can send anyone else's id — it identifies a
// browser the way the name identifies a person, which is to say: on the honour
// system. Clearing site data makes you a new person.
const CLIENT_KEY = 'kawaii-board.client-id'

function readOrMintClientId() {
  try {
    const existing = localStorage.getItem(CLIENT_KEY)
    if (existing) return existing
    const minted = crypto.randomUUID()
    localStorage.setItem(CLIENT_KEY, minted)
    return minted
  } catch {
    // Private browsing can refuse storage. A per-session id still lets the
    // feed work for this tab; it just won't be remembered.
    return crypto.randomUUID()
  }
}

let clientId = readOrMintClientId()

export const getClientId = () => clientId

// --- avatar -----------------------------------------------------------------
// Only a cache of the URL the server gave back. The profile row is the source
// of truth, so a browser that loses this can recover it from
// GET /api/profile/:clientId.
const AVATAR_KEY = 'kawaii-board.avatar'

function readAvatar() {
  try {
    return localStorage.getItem(AVATAR_KEY)
  } catch {
    return null
  }
}

let avatarUrl = readAvatar()

export const getAvatarUrl = () => avatarUrl

export function setAvatarUrl(value) {
  avatarUrl = value || null
  try {
    if (avatarUrl) localStorage.setItem(AVATAR_KEY, avatarUrl)
    else localStorage.removeItem(AVATAR_KEY)
  } catch {
    // Keep it in memory for this session.
  }
  return avatarUrl
}
