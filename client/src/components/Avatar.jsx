// Somebody's picture, or their initials if they haven't uploaded one.
//
// The initials fallback picks its colour from the name itself, so the same
// person is always the same colour and a feed of unpictured people still
// reads as a feed of distinct people rather than a column of identical blanks.
const COLORS = [
  '#e84f8c',
  '#8f5fd0',
  '#3f8fd0',
  '#2f9c8a',
  '#c9821f',
  '#c0453f',
  '#5f8f3f',
  '#7a5ad0',
]

function initials(name) {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0]).join('').toUpperCase() || '?'
}

function colorFor(name) {
  let hash = 0
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) % 997
  return COLORS[hash % COLORS.length]
}

export default function Avatar({ name, url, size = 40, className = '' }) {
  const label = name?.trim() || 'someone'

  if (url) {
    return (
      <img
        className={`avatar ${className}`}
        src={url}
        alt={label}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        loading="lazy"
      />
    )
  }

  return (
    <span
      className={`avatar avatar--initials ${className}`}
      style={{ width: size, height: size, background: colorFor(label), fontSize: size * 0.4 }}
      aria-label={label}
      role="img"
    >
      {initials(label)}
    </span>
  )
}
