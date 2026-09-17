import { useState } from 'react'

export default function Entry({ entry, theme, canEdit, onEdit, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(entry.text)
  const [busy, setBusy] = useState(false)

  function startEditing() {
    setValue(entry.text) // discard any abandoned draft from last time
    setEditing(true)
  }

  function cancel() {
    setValue(entry.text)
    setEditing(false)
  }

  async function save(e) {
    e.preventDefault()
    const next = value.trim()
    if (!next || busy) return
    if (next === entry.text) return setEditing(false) // nothing to send
    setBusy(true)
    try {
      await onEdit(entry.id, next)
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
          <input
            className="entry__input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && cancel()}
            maxLength={200}
            aria-label={`Edit "${entry.text}"`}
            autoFocus
          />
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
      <span className="entry__text">{entry.text}</span>
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
