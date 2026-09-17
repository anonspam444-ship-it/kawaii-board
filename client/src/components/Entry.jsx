export default function Entry({ entry, theme, onDelete }) {
  return (
    <li className={`entry entry--${theme}`}>
      <span className="entry__pin" aria-hidden="true" />
      <span className="entry__text">{entry.text}</span>
      <button
        type="button"
        className="entry__delete"
        onClick={() => onDelete(entry.id)}
        aria-label={`Remove "${entry.text}"`}
        title="Remove"
      >
        ×
      </button>
    </li>
  )
}
