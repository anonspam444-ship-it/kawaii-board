import { useState } from 'react'

export default function Entry({ entry, theme, canEdit, onEdit, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(entry.text)
  // '' rather than null so the input stays controlled; converted back on save.
  const [author, setAuthor] = useState(entry.author ?? '')
  const [busy, setBusy] = useState(false)

  function reset() {
    setValue(entry.text) // discard any abandoned draft from last time
    setAuthor(entry.author ?? '')
  }

  function startEditing() {
    reset()
    setEditing(true)
  }

  function cancel() {
    reset()
    setEditing(false)
  }

  async function save(e) {
    e.preventDefault()
    const nextText = value.trim()
    const nextAuthor = author.trim()
    if (!nextText || busy) return

    // Send only what actually changed, so editing the name doesn't rewrite the
    // text (and vice versa) and an untouched entry sends nothing at all.
    const patch = {}
    if (nextText !== entry.text) patch.text = nextText
    if (nextAuthor !== (entry.author ?? '')) patch.author = nextAuthor || null
    if (Object.keys(patch).length === 0) return setEditing(false)

    setBusy(true)
    try {
      await onEdit(entry.id, patch)
      setEditing(false)
    } catch {
      // App surfaces the error banner; stay open so the edit can be retried.
    } finally {
      setBusy(false)
    }
  }

  if (editing) {
    return (
      <li className={`entry entry--${theme} entry--editing`}>
        <form className="entry__edit" onSubmit={save}>
          <span className="entry__edit-fields">
            <input
              className="entry__input"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && cancel()}
              maxLength={200}
              aria-label={`Edit "${entry.text}"`}
              autoFocus
            />
            <input
              className="entry__input entry__input--author"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && cancel()}
              maxLength={40}
              placeholder="who pinned it?"
              aria-label={`Who pinned "${entry.text}"`}
            />
          </span>
          <button
            type="submit"
            className="entry__action"
            disabled={busy || !value.trim()}
            title="Save"
            aria-label="Save changes"
          >
            ✓
          </button>
          <button
            type="button"
            className="entry__action"
            onClick={cancel}
            title="Cancel"
            aria-label="Cancel editing"
          >
            ✕
          </button>
        </form>
      </li>
    )
  }

  return (
    <li className={`entry entry--${theme}`}>
      <span className="entry__pin" aria-hidden="true" />
      <span className="entry__body">
        <span className="entry__text">{entry.text}</span>
        {/* Entries predating the author column have nobody to credit, so the
            byline is omitted entirely rather than rendered as "— unknown". */}
        {entry.author && <span className="entry__author">— {entry.author}</span>}
      </span>
      {canEdit && (
        <span className="entry__actions">
          <button
            type="button"
            className="entry__action"
            onClick={startEditing}
            aria-label={`Edit "${entry.text}"`}
            title="Edit"
          >
            ✎
          </button>
          <button
            type="button"
            className="entry__action entry__delete"
            onClick={() => onDelete(entry.id)}
            aria-label={`Remove "${entry.text}"`}
            title="Remove"
          >
            ×
          </button>
        </span>
      )}
    </li>
  )
}
