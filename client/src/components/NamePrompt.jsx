import { useState } from 'react'
import { MAX_NAME } from '../identity.js'

// The whole of "who are you" on this board: a name, typed once, kept in
// localStorage. Shown on first visit, and again if you try to pin something
// without one — at which point it can't be dismissed, since an unsigned entry
// is the thing we're trying to avoid.
export default function NamePrompt({ initial = '', required = false, onSave, onSkip }) {
  const [value, setValue] = useState(initial)
  const name = value.trim()

  function submit(e) {
    e.preventDefault()
    if (!name) return
    onSave(name)
  }

  return (
    <div
      className="name-prompt"
      role="dialog"
      aria-modal="true"
      aria-labelledby="name-prompt-title"
      // Clicking the backdrop is the usual way out of a modal, but only when
      // there is a way out: in required mode the form is the only exit.
      onMouseDown={(e) => !required && e.target === e.currentTarget && onSkip()}
    >
      <form className="name-prompt__card" onSubmit={submit}>
        <h2 className="name-prompt__title" id="name-prompt-title">
          {required ? 'Sign it first' : 'Who goes there?'}
        </h2>

        {/* Only the blocking version explains itself — it needs to say why it
            won't go away. Asking for a name is self-explanatory otherwise. */}
        {required && (
          <p className="name-prompt__blurb">
            Everything pinned to this board gets a name on it. Yours?
          </p>
        )}

        <label className="name-prompt__label" htmlFor="name-prompt-input">
          Your name
        </label>
        <input
          id="name-prompt-input"
          className="name-prompt__input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && !required && onSkip()}
          placeholder="e.g. josh"
          maxLength={MAX_NAME}
          autoComplete="nickname"
          autoFocus
        />

        <div className="name-prompt__actions">
          <button type="submit" className="name-prompt__btn" disabled={!name}>
            {required ? 'Sign in blood' : "That's me"}
          </button>
          {!required && (
            <button
              type="button"
              className="name-prompt__btn name-prompt__btn--quiet"
              onClick={onSkip}
            >
              Just looking
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
