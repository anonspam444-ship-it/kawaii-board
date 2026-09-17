import { mockEntries } from './mockData.js'

// Flip VITE_USE_MOCK=true to run the client with no server (in-memory data).
// Leave VITE_API_BASE blank to use the dev proxy / same-origin in production,
// or set it to a full origin (e.g. https://api.example.com) when the API lives
// somewhere else.
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'
const BASE = import.meta.env.VITE_API_BASE ?? ''

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
async function req(path, options) {
  const res = await fetch(`${BASE}/api/entries${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Request failed (${res.status})`)
  }
  return res.status === 204 ? null : res.json()
}

export const getEntries = () =>
  USE_MOCK ? mockApi.list() : req('')

export const createEntry = (text, list) =>
  USE_MOCK
    ? mockApi.add(text, list)
    : req('', { method: 'POST', body: JSON.stringify({ text, list }) })

export const deleteEntry = (id) =>
  USE_MOCK ? mockApi.remove(id) : req(`/${id}`, { method: 'DELETE' })
