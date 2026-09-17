import AddForm from './AddForm.jsx'
import Entry from './Entry.jsx'
import { PLACEHOLDERS } from '../mockData.js'
import '../styles/column.css'

export default function Column({ theme, title, entries, loading, canEdit, onAdd, onDelete }) {
  const examples = PLACEHOLDERS[theme] ?? []

  return (
    <section className={`column column--${theme}`}>
      <h2 className="column__title">{title}</h2>

      {canEdit ? (
        <AddForm theme={theme} onAdd={onAdd} placeholders={examples} />
      ) : (
        <p className="column__locked">
          {theme === 'worth' ? 'Unlock to pin.' : 'Unlock to nail.'}
        </p>
      )}

      <ul className="column__list">
        {loading && <li className="column__hint">Loading…</li>}

        {!loading && entries.length === 0 && (
          <li className="column__empty">
            {theme === 'worth'
              ? 'Nothing worthy pinned yet. For example:'
              : 'No horrors nailed up… yet. For example:'}
            <ul className="column__examples">
              {examples.map((ex) => (
                <li key={ex}>{ex}</li>
              ))}
            </ul>
          </li>
        )}

        {entries.map((e) => (
          <Entry key={e.id} entry={e} theme={theme} canEdit={canEdit} onDelete={onDelete} />
        ))}
      </ul>
    </section>
  )
}
