import { Fragment, useEffect, useState } from 'react'
import Column from './components/Column.jsx'
import { getEntries, createEntry, deleteEntry } from './api.js'
import './styles/board.css'

// Add more lists here later (each needs matching theme styles + placeholders).
const LISTS = [
  { key: 'worth', title: 'Worth List', theme: 'worth' },
  { key: 'worst', title: 'Worst List', theme: 'worst' },
]

export default function App() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    getEntries()
      .then(setEntries)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  async function handleAdd(text, list) {
    setError(null)
    try {
      const entry = await createEntry(text, list)
      setEntries((prev) => [...prev, entry])
    } catch (e) {
      setError(e.message)
      throw e // AddForm keeps the text so it can be retried
    }
  }

  async function handleDelete(id) {
    const snapshot = entries
    setEntries((prev) => prev.filter((e) => e.id !== id)) // optimistic
    try {
      await deleteEntry(id)
    } catch (e) {
      setError(e.message)
      setEntries(snapshot) // roll back on failure
    }
  }

  return (
    <div className="board">
      <div className="board__frame">
        <header className="board__header">
          <h1 className="board__title">The Quest Board</h1>
          <p className="board__subtitle">Pin the worthy · Nail the worst</p>
        </header>

        {error && <p className="board__error">⚠ {error}</p>}

        <div className="board__columns">
          {LISTS.map((l, i) => (
            <Fragment key={l.key}>
              {i > 0 && <div className="board__divider" aria-hidden="true" />}
              <Column
                theme={l.theme}
                title={l.title}
                loading={loading}
                entries={entries.filter((e) => e.list === l.key)}
                onAdd={(text) => handleAdd(text, l.key)}
                onDelete={handleDelete}
              />
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  )
}
