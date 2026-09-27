import { useState } from 'react'
import { getVisits } from '../api.js'
import '../styles/admin.css'

// The visit log, reachable at #admin. Not linked from anywhere — it isn't
// secret (the guard is the passphrase, not the obscurity), it just has no
// business being a button on a board other people use.
//
// The key is held in component state only, never in localStorage: this is the
// one credential whose leak exposes other people's data rather than letting
// someone scribble on a board, so forgetting it when the tab closes is the
// right default.
export default function AdminPanel({ onClose }) {
  const [key, setKey] = useState('')
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function load(event) {
    event.preventDefault()
    if (!key || busy) return
    setBusy(true)
    setError(null)
    try {
      setData(await getVisits(key))
    } catch (e) {
      setError(e.message)
      setData(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="admin">
      <div className="admin__bar">
        <h1 className="admin__title">Visit log</h1>
        <button type="button" className="admin__close" onClick={onClose}>
          ← back to the board
        </button>
      </div>

      {!data ? (
        <form className="admin__gate" onSubmit={load}>
          <label className="admin__label" htmlFor="admin-key">
            Admin key
          </label>
          <input
            id="admin-key"
            className="admin__input"
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="ADMIN_PASSWORD"
            autoComplete="off"
            autoFocus
          />
          <button type="submit" className="admin__btn" disabled={busy || !key}>
            {busy ? 'Reading…' : 'Open the log'}
          </button>
          {error && <p className="admin__error">⚠ {error}</p>}
        </form>
      ) : (
        <>
          <div className="admin__stats">
            <span>
              <strong>{data.total}</strong> visits
            </span>
            <span>
              <strong>{data.unique_ips}</strong> unique IPs
            </span>
            {/* The plain-text version, which the key has to be re-typed for
                since it travels in a header the browser can't add to a link. */}
            <code className="admin__curl">
              curl -H &quot;X-Admin-Key: …&quot; {location.origin}/api/admin/visits.log
            </code>
          </div>

          <h2 className="admin__subtitle">Most frequent</h2>
          <table className="admin__table">
            <thead>
              <tr>
                <th>IP</th>
                <th>Visits</th>
                <th>Names</th>
                <th>Last seen</th>
              </tr>
            </thead>
            <tbody>
              {data.top.map((row) => (
                <tr key={row.ip}>
                  <td>{row.ip}</td>
                  <td>{row.visits}</td>
                  <td>{row.names.join(', ') || '—'}</td>
                  <td>{new Date(row.last).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2 className="admin__subtitle">Every visit, newest first</h2>
          <table className="admin__table admin__table--log">
            <thead>
              <tr>
                <th>When</th>
                <th>IP</th>
                <th>Name</th>
                <th>Path</th>
                <th>Referrer</th>
                <th>User agent</th>
              </tr>
            </thead>
            <tbody>
              {data.visits.map((row) => (
                <tr key={row.id}>
                  <td>{new Date(row.created_at).toLocaleString()}</td>
                  <td>{row.ip ?? '—'}</td>
                  <td>{row.name ?? '—'}</td>
                  <td>{row.path ?? '—'}</td>
                  <td className="admin__wrap">{row.referrer ?? '—'}</td>
                  <td className="admin__wrap">{row.user_agent ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}
