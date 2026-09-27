import { mockEntries, mockStreak } from './mockData.js'
import { getClientId, getName } from './identity.js'
import {
  authHeaders,
  clearToken,
  setToken,
  clearStreakToken,
  setStreakToken,
  streakHeaders,
} from './auth.js'

// Flip VITE_USE_MOCK=true to run the client with no server (in-memory data).
// Leave VITE_API_BASE blank to use the dev proxy / same-origin in production,
// or set it to a full origin (e.g. https://api.example.com) when the API lives
// somewhere else.
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'
const BASE = import.meta.env.VITE_API_BASE ?? ''

// Mock mode has no server and therefore no passphrase to check.
export const isMock = USE_MOCK

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

// Today's date in the *browser's* timezone, as YYYY-MM-DD. Deliberately not
// toISOString(), which is UTC: on the evening of the 5th in New York that
// returns the 6th, which would silently consume tomorrow's check-in.
export function localToday(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// --- in-memory mock backend, used only when USE_MOCK is on ------------------
let mem = [...mockEntries]
let memStreak = { ...mockStreak }

const mockApi = {
  list: async () => [...mem],
  add: async (text, list, author) => {
    const entry = {
      id: crypto.randomUUID(),
      text,
      list,
      author: author ?? null,
      created_at: new Date().toISOString(),
    }
    mem = [...mem, entry]
    return entry
  },
  edit: async (id, patch) => {
    let updated = null
    mem = mem.map((e) => (e.id === id ? (updated = { ...e, ...patch }) : e))
    return updated
  },
  remove: async (id) => {
    mem = mem.filter((e) => e.id !== id)
  },
  streak: async () => ({ ...memStreak }),
  checkIn: async (today) => {
    if (memStreak.last_check_in === today) {
      throw new ApiError('Already counted today. Come back tomorrow.', 409)
    }
    const count = memStreak.count + 1
    memStreak = {
      ...memStreak,
      count,
      best: Math.max(memStreak.best, count),
      last_check_in: today,
    }
    return { ...memStreak }
  },
  reset: async (today) => {
    memStreak = { ...memStreak, count: 0, last_check_in: today }
    return { ...memStreak }
  },
}

// --- real API ---------------------------------------------------------------
// `auth` picks which credential rides along, and therefore which one gets
// thrown away on a 401: a rejected streak key must not log you out of the
// board, and vice versa.
// The feed identifies the caller with a header as well as a body field: the
// body is how a write says who wrote it, the header is how a delete proves
// (on the honour system) that it's removing its own.
const clientHeaders = () => ({ 'X-Client-Id': getClientId() })

async function request(path, { auth = 'board', ...options } = {}) {
  const credential =
    auth === 'streak' ? streakHeaders() : auth === 'none' ? {} : authHeaders()

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...credential, ...options.headers },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    // A stored passphrase the server rejects is worthless — drop it so the UI
    // falls back to locked instead of retrying with a dead credential.
    if (res.status === 401) {
      if (auth === 'streak') clearStreakToken()
      else if (auth === 'board') clearToken()
    }
    throw new ApiError(body.error || `Request failed (${res.status})`, res.status)
  }

  return res.status === 204 ? null : res.json()
}

const entries = (path = '', options) => request(`/api/entries${path}`, options)

export const getEntries = () => (USE_MOCK ? mockApi.list() : entries())

export const createEntry = (text, list, author) =>
  USE_MOCK
    ? mockApi.add(text, list, author)
    : entries('', { method: 'POST', body: JSON.stringify({ text, list, author }) })

// `patch` is { text?, author? } — only the keys present are written, so this
// renames, re-signs, or does both.
export const updateEntry = (id, patch) =>
  USE_MOCK
    ? mockApi.edit(id, patch)
    : entries(`/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })

export const deleteEntry = (id) =>
  USE_MOCK ? mockApi.remove(id) : entries(`/${id}`, { method: 'DELETE' })

// Check a passphrase before storing it, so the unlock box can report a bad one
// immediately rather than failing on the next pin. Stores on success.
export async function unlock(passphrase) {
  if (USE_MOCK) return true
  setToken(passphrase)
  try {
    await request('/api/session', { method: 'POST' })
    return true
  } catch (e) {
    if (e.status === 401) clearToken() // already cleared by request(), belt and braces
    throw e
  }
}

// --- streak -----------------------------------------------------------------
export const getStreak = () => (USE_MOCK ? mockApi.streak() : request('/api/streak'))

// The browser's own date goes up with the write so "one per day" tracks her
// calendar, not the server's. See localToday above.
export const checkInStreak = (today = localToday()) =>
  USE_MOCK
    ? mockApi.checkIn(today)
    : request('/api/streak/check-in', {
        auth: 'streak',
        method: 'POST',
        body: JSON.stringify({ today }),
      })

export const resetStreak = (today = localToday()) =>
  USE_MOCK
    ? mockApi.reset(today)
    : request('/api/streak/reset', {
        auth: 'streak',
        method: 'POST',
        body: JSON.stringify({ today }),
      })

export async function unlockStreak(passphrase) {
  if (USE_MOCK) return true
  setStreakToken(passphrase)
  try {
    await request('/api/streak/session', { auth: 'streak', method: 'POST' })
    return true
  } catch (e) {
    if (e.status === 401) clearStreakToken()
    throw e
  }
}

// --- profile ----------------------------------------------------------------
export const getProfile = (clientId = getClientId()) =>
  USE_MOCK ? null : request(`/api/profile/${clientId}`, { auth: 'none' })

// `avatar` is a base64 data URL, or omit it to keep the stored one.
// `removeAvatar` clears it.
export const saveProfile = ({ name, avatar, removeAvatar } = {}) =>
  USE_MOCK
    ? { client_id: getClientId(), name, avatar_url: avatar ?? null }
    : request('/api/profile', {
        auth: 'none',
        method: 'PUT',
        body: JSON.stringify({
          client_id: getClientId(),
          name,
          ...(avatar ? { avatar } : {}),
          ...(removeAvatar ? { remove_avatar: true } : {}),
        }),
      })

// --- feed -------------------------------------------------------------------
// client_id rides along on the read too, so the server can mark which posts
// this browser has already liked and which are its own.
export const getFeed = () =>
  USE_MOCK
    ? []
    : request(`/api/feed?client_id=${encodeURIComponent(getClientId())}`, { auth: 'none' })

export const createPost = ({ body, image }) =>
  request('/api/feed', {
    auth: 'none',
    method: 'POST',
    body: JSON.stringify({ client_id: getClientId(), body, ...(image ? { image } : {}) }),
  })

export const deletePost = (id) =>
  request(`/api/feed/${id}`, { auth: 'board', method: 'DELETE', headers: clientHeaders() })

export const togglePostLike = (id) =>
  request(`/api/feed/${id}/like`, {
    auth: 'none',
    method: 'POST',
    body: JSON.stringify({ client_id: getClientId() }),
  })

export const createComment = (postId, body) =>
  request(`/api/feed/${postId}/comments`, {
    auth: 'none',
    method: 'POST',
    body: JSON.stringify({ client_id: getClientId(), body }),
  })

export const deleteComment = (postId, commentId) =>
  request(`/api/feed/${postId}/comments/${commentId}`, {
    auth: 'board',
    method: 'DELETE',
    headers: clientHeaders(),
  })

// --- visit beacon -----------------------------------------------------------
// Fired once per page load. Deliberately unawaited and never surfaced: the
// board must not care whether the log worked.
export function logVisit() {
  if (USE_MOCK) return
  request('/api/visit', {
    auth: 'none',
    method: 'POST',
    body: JSON.stringify({
      client_id: getClientId(),
      name: getName(),
      path: location.pathname + location.search,
    }),
  }).catch(() => {})
}

// --- admin ------------------------------------------------------------------
// The visit log. The key is held in memory only — it is never written to
// localStorage, so closing the tab forgets it.
export const getVisits = (adminKey, limit = 500) =>
  request(`/api/admin/visits?limit=${limit}`, {
    auth: 'none',
    headers: { 'X-Admin-Key': adminKey },
  })

// --- notifications ----------------------------------------------------------
// `since` is the highest event id this browser has already shown. Passing null
// asks only for the current high-water mark, which is how a new browser starts
// from "now" instead of opening to a burst of old toasts.
export const getEvents = (since) =>
  USE_MOCK
    ? { latest_id: 0, events: [] }
    : request(
        `/api/events?client_id=${encodeURIComponent(getClientId())}` +
          (since === null || since === undefined ? '' : `&since=${since}`),
        { auth: 'none' },
      )
