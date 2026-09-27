import { useRef, useState } from 'react'
import Avatar from './Avatar.jsx'
import { MAX_NAME } from '../identity.js'
import { toSquareDataUrl } from '../lib/image.js'

// The whole of "who are you" on this board: a name and, optionally, a picture.
// Shown on first visit, and again if you try to post or pin without a name —
// at which point it can't be dismissed, since unsigned content is the thing
// we're trying to avoid.
//
// Saving now hits the network (the avatar has to be uploaded so other people
// can see it), so this owns a busy and an error state.
export default function NamePrompt({
  initialName = '',
  initialAvatarUrl = null,
  required = false,
  onSave,
  onSkip,
}) {
  const [value, setValue] = useState(initialName)
  // Newly picked, resized, not yet uploaded.
  const [avatar, setAvatar] = useState(null)
  const [dropped, setDropped] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const fileInput = useRef(null)

  const name = value.trim()
  const shownAvatar = dropped ? null : (avatar ?? initialAvatarUrl)

  async function pick(event) {
    const file = event.target.files?.[0]
    event.target.value = '' // so re-picking the same file fires onChange again
    if (!file) return

    setError(null)
    try {
      setAvatar(await toSquareDataUrl(file))
      setDropped(false)
    } catch (e) {
      setError(e.message)
    }
  }

  async function submit(event) {
    event.preventDefault()
    if (!name || busy) return

    setBusy(true)
    setError(null)
    try {
      await onSave({ name, avatar, removeAvatar: dropped && !avatar })
    } catch (e) {
      setError(e.message) // stay open so it can be retried
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="name-prompt"
      role="dialog"
      aria-modal="true"
      aria-labelledby="name-prompt-title"
      // Clicking the backdrop is the usual way out of a modal, but only when
      // there is a way out: in required mode the form is the only exit.
      onMouseDown={(e) => !required && !busy && e.target === e.currentTarget && onSkip()}
    >
      <form className="name-prompt__card" onSubmit={submit}>
        <h2 className="name-prompt__title" id="name-prompt-title">
          {required ? 'Sign it first' : 'Who goes there?'}
        </h2>

        {required && (
          <p className="name-prompt__blurb">
            Everything you put on this board gets a name on it. Yours?
          </p>
        )}

        <button
          type="button"
          className="name-prompt__pic"
          onClick={() => fileInput.current?.click()}
          title="Choose a picture"
        >
          <Avatar name={name || 'you'} url={shownAvatar} size={88} />
          <span className="name-prompt__pic-hint">
            {shownAvatar ? 'Change picture' : 'Add a picture'}
          </span>
        </button>

        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="visually-hidden"
          onChange={pick}
          tabIndex={-1}
        />

        {shownAvatar && (
          <button
            type="button"
            className="name-prompt__pic-drop"
            onClick={() => {
              setAvatar(null)
              setDropped(true)
            }}
          >
            Remove picture
          </button>
        )}

        <label className="name-prompt__label" htmlFor="name-prompt-input">
          Your name
        </label>
        <input
          id="name-prompt-input"
          className="name-prompt__input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && !required && !busy && onSkip()}
          placeholder="e.g. josh"
          maxLength={MAX_NAME}
          autoComplete="nickname"
          autoFocus
        />

        {error && <p className="name-prompt__error">{error}</p>}

        <div className="name-prompt__actions">
          <button type="submit" className="name-prompt__btn" disabled={!name || busy}>
            {busy ? 'Saving…' : required ? 'Sign in blood' : "That's me"}
          </button>
          {!required && (
            <button
              type="button"
              className="name-prompt__btn name-prompt__btn--quiet"
              onClick={onSkip}
              disabled={busy}
            >
              Just looking
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
