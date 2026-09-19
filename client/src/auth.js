// Where the board passphrase lives in the browser. localStorage (not a cookie)
// because the API takes a bearer token, so nothing should be attached to
// cross-site requests automatically. Wrapped in try/catch: private browsing
// modes can throw on access, and a board that still works for one session is
// better than a blank page.
const KEY = 'kawaii-board.passphrase'

function read() {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

let token = read()

export const getToken = () => token

export const hasToken = () => Boolean(token)

export function setToken(value) {
  token = value || null
  try {
    if (token) localStorage.setItem(KEY, token)
    else localStorage.removeItem(KEY)
  } catch {
    // Keep it in memory for this session; nothing else we can do.
  }
}

export const clearToken = () => setToken(null)

export const authHeaders = () => (token ? { Authorization: `Bearer ${token}` } : {})

// --- streak passphrase ------------------------------------------------------
// The no-contact counter has its own credential, kept separately from the board
// passphrase: holding one must not grant the other. Sent as X-Streak-Key rather
// than Authorization so a browser carrying both can present both at once.
const STREAK_KEY = 'kawaii-board.streak-key'

function readStreak() {
  try {
    return localStorage.getItem(STREAK_KEY)
  } catch {
    return null
  }
}

let streakToken = readStreak()

export const hasStreakToken = () => Boolean(streakToken)

export function setStreakToken(value) {
  streakToken = value || null
  try {
    if (streakToken) localStorage.setItem(STREAK_KEY, streakToken)
    else localStorage.removeItem(STREAK_KEY)
  } catch {
    // Keep it in memory for this session; nothing else we can do.
  }
}

export const clearStreakToken = () => setStreakToken(null)

export const streakHeaders = () => (streakToken ? { 'X-Streak-Key': streakToken } : {})
