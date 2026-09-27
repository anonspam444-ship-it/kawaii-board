import { useEffect, useState } from 'react'
import { getEvents } from '../api.js'

// Polling, not a socket.
//
// A websocket or Supabase realtime subscription would mean either shipping a
// database key to the browser or keeping a connection open per visitor, and
// for a board this size that's machinery in exchange for a few seconds of
// latency. A poll also makes "already open" and "opened just now" the same
// code path: both ask "anything newer than what I've shown?"
const POLL_MS = 25_000

// The cursor is per-browser, not per-account — same honour system as the rest
// of the feed. Losing it just means starting from "now" again.
const CURSOR_KEY = 'kawaii-board.events-cursor'

function readCursor() {
  try {
    const raw = localStorage.getItem(CURSOR_KEY)
    return raw === null ? null : Number(raw)
  } catch {
    return null
  }
}

function writeCursor(id) {
  try {
    localStorage.setItem(CURSOR_KEY, String(id))
  } catch {
    // Private browsing: the session still works, it just starts fresh again.
  }
}

// Keep the stack short. If someone's been away a week, five toasts tell them
// as much as twenty and don't bury the page.
const MAX_VISIBLE = 5

export function useNotifications(enabled) {
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    if (!enabled) return

    let cancelled = false
    let timer

    async function tick() {
      try {
        const { latest_id, events } = await getEvents(readCursor())
        if (cancelled) return

        if (events?.length) {
          setToasts((prev) => [...prev, ...events].slice(-MAX_VISIBLE))
        }
        // Advance the cursor even when nothing came back, so a quiet period
        // doesn't leave us re-asking about the same range forever.
        if (typeof latest_id === 'number') writeCursor(latest_id)
      } catch {
        // Offline, or the events table isn't migrated yet. Either way the
        // board keeps working and we try again on the next tick.
      }
      if (!cancelled) timer = setTimeout(tick, POLL_MS)
    }

    tick()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [enabled])

  const dismiss = (id) => setToasts((prev) => prev.filter((t) => t.id !== id))

  return { toasts, dismiss }
}
