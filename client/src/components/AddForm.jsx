import { useState } from 'react'

export default function AddForm({ theme, onAdd, placeholders }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const placeholder = placeholders?.[0] ?? 'Add an entry…'

  async function submit(e) {
    e.preventDefault()
    const value = text.trim()
    if (!value || busy) return
    setBusy(true)
    try {
      await onAdd(value)
      setText('')
    } catch {
      // App surfaces the error banner; keep the text so it can be retried.
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="add-form" onSubmit={submit}>
      <input
        className="add-form__input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        maxLength={200}
        aria-label="New entry"
      />
      <button type="submit" className="add-form__btn" disabled={busy}>
        {theme === 'worth' ? 'Pin it' : 'Nail it'}
      </button>
    </form>
  )
}
