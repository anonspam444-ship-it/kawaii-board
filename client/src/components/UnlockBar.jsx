import { useState } from 'react'

// Writes need the board passphrase. This is the only place it gets typed; it
// then lives in localStorage and rides along as a bearer token.
export default function UnlockBar({ unlocked, onUnlock, onLock }) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (!value || busy) return
    setBusy(true)
    try {
      await onUnlock(value)
      setValue('')
      setOpen(false)
    } catch {
      // App surfaces the error banner; keep the box open to retry.
    } finally {
      setBusy(false)
    }
  }

  if (unlocked) {
    return (
      <div className="lock">
        <span className="lock__status lock__status--open">🔓 Unlocked</span>
        <button type="button" className="lock__btn" onClick={onLock}>
          Lock board
        </button>
      </div>
    )
  }

  if (!open) {
    return (
      <div className="lock">
        <span className="lock__status">🔒 Locked — viewing only</span>
        <button type="button" className="lock__btn" onClick={() => setOpen(true)}>
          Unlock
        </button>
      </div>
    )
  }

  return (
    <form className="lock" onSubmit={submit}>
      <input
        className="lock__input"
        type="password"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Board passphrase"
        aria-label="Board passphrase"
        autoComplete="current-password"
        autoFocus
      />
      <button type="submit" className="lock__btn" disabled={busy || !value}>
        {busy ? 'Checking…' : 'Unlock'}
      </button>
      <button
        type="button"
        className="lock__btn lock__btn--quiet"
        onClick={() => {
          setOpen(false)
          setValue('')
        }}
      >
        Cancel
      </button>
    </form>
  )
}
