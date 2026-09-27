import { useEffect } from 'react'
import Avatar from './Avatar.jsx'
import { parseEmoji } from '../emoji.js'
import '../styles/toasts.css'

const VISIBLE_MS = 7000

// "josh liked your post", "steph posted" — the actor, what they did, and a
// glimpse of what it was about.
function describe(event) {
  switch (event.kind) {
    case 'like':
      return 'liked your post'
    case 'comment':
      return 'replied to your post'
    case 'post':
      return 'posted'
    default:
      return 'did something'
  }
}

// Shortcodes are stripped rather than rendered as images: at this size a row
// of emoji pictures in a one-line excerpt is noise, and the point of the
// snippet is only to jog your memory about which post it was.
function plain(snippet) {
  if (!snippet) return null
  const text = parseEmoji(snippet)
    .map((part) => (part.type === 'text' ? part.value : ''))
    .join('')
    .trim()
  return text || null
}

function Toast({ event, onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(event.id), VISIBLE_MS)
    return () => clearTimeout(timer)
  }, [event.id, onDismiss])

  const name = event.actor?.name?.trim() || 'someone'
  const snippet = plain(event.snippet)

  return (
    <li className={`toast toast--${event.kind}`}>
      <Avatar name={name} url={event.actor?.avatar_url} size={36} />

      <div className="toast__body">
        <p className="toast__line">
          <strong>{name}</strong> {describe(event)}
        </p>
        {snippet && <p className="toast__snippet">{snippet}</p>}
      </div>

      <button
        type="button"
        className="toast__close"
        onClick={() => onDismiss(event.id)}
        aria-label="Dismiss"
      >
        ×
      </button>
    </li>
  )
}

export default function Toasts({ toasts, onDismiss }) {
  if (!toasts.length) return null

  return (
    // polite, not assertive: these are incidental, and shouldn't interrupt
    // whatever a screen reader is in the middle of.
    <ul className="toasts" role="status" aria-live="polite">
      {toasts.map((event) => (
        <Toast key={event.id} event={event} onDismiss={onDismiss} />
      ))}
    </ul>
  )
}
