import { useEffect, useRef, useState } from 'react'
import { getEvents } from '../api.js'

// Polling, not a socket.
//
// A websocket or Supabase realtime subscription would mean either shipping a
// database key to the browser or holding a connection open per visitor, and
// for a board this size that's machinery in exchange for a few seconds. A poll
// also makes "already open" and "opened just now" the same code path: both ask
// "anything newer than what I've shown?"
//
// 25s was too slow to feel live — a post took up to half a minute to show up.
// 4s is close enough to instant at this scale, and it only runs while the tab
// is actually being looked at (see below), so an idle background tab costs
// nothing rather than one request every few seconds forever.
const POLL_MS = 4000

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

export function useNotifications(enabled, onActivity) {
  const [toasts, setToasts] = useState([])

  // Held in a ref so changing the callback doesn't tear down and restart the
  // poll — App passes a fresh closure on every render.
  const activity = useRef(onActivity)
  activity.current = onActivity

  useEffect(() => {
    if (!enabled) return

    let cancelled = false
    let timer

    async function tick() {
      // Don't poll a tab nobody is looking at. The catch-up on the way back is
      // the same request, so nothing is missed — it just arrives on focus.
      if (document.hidden) {
        if (!cancelled) timer = setTimeout(tick, POLL_MS)
        return
      }

      try {
        const { latest_id, events } = await getEvents(readCursor())
        if (cancelled) return

        if (events?.length) {
          setToasts((prev) => [...prev, ...events].slice(-MAX_VISIBLE))
          // Tell the feed something happened so it can reload. Without this a
          // toast says "dave posted" and the post isn't on screen until reload.
          activity.current?.(events)
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

    // Coming back to the tab should feel immediate rather than waiting out
    // whatever remained of the interval.
    function onVisible() {
      if (!document.hidden && !cancelled) {
        clearTimeout(timer)
        tick()
      }
    }

    tick()
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [enabled])

  const dismiss = (id) => setToasts((prev) => prev.filter((t) => t.id !== id))

  return { toasts, dismiss }
}
