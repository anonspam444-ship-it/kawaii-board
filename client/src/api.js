import { mockEntries } from './mockData.js'
import { authHeaders, clearToken, setToken } from './auth.js'

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

// --- in-memory mock backend, used only when USE_MOCK is on ------------------
let mem = [...mockEntries]
const mockApi = {
  list: async () => [...mem],
  add: async (text, list) => {
    const entry = { id: crypto.randomUUID(), text, list, created_at: new Date().toISOString() }
    mem = [...mem, entry]
    return entry
  },
  remove: async (id) => {
    mem = mem.filter((e) => e.id !== id)
  },
}

// --- real API ---------------------------------------------------------------
async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...options.headers },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    // A stored passphrase the server rejects is worthless — drop it so the UI
    // falls back to locked instead of retrying with a dead credential.
    if (res.status === 401) clearToken()
    throw new ApiError(body.error || `Request failed (${res.status})`, res.status)
  }

  return res.status === 204 ? null : res.json()
}

const entries = (path = '', options) => request(`/api/entries${path}`, options)

export const getEntries = () => (USE_MOCK ? mockApi.list() : entries())

export const createEntry = (text, list) =>
  USE_MOCK
    ? mockApi.add(text, list)
    : entries('', { method: 'POST', body: JSON.stringify({ text, list }) })

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
