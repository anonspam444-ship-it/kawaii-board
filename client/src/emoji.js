// The custom emoji set.
//
// These are image files in client/public/emojis, served as static assets at
// /emojis/<file>. A post stores the shortcode (":smile:") as plain text, not
// HTML — rendering resolves it to an <img> at display time. That way the
// database holds something readable, nothing user-typed ever becomes markup,
// and renaming or replacing an emoji is a change to this file alone.
//
// Filenames are opaque ids from wherever these were exported, so the names
// here are the only human-readable handle. Rename freely; existing posts that
// used an old shortcode will simply show it as text.
export const EMOJI = [
  { name: 'smile', file: '1353909602424717392.webp' },
  { name: 'dog', file: '1539300842149253290.webp' },
  { name: 'worried', file: '406565199273787412.webp' },
  { name: 'rude', file: '406565298611945472.webp' },
  { name: 'unamused', file: '406566105478332436.webp' },
  { name: 'facepalm', file: '406566224827383809.webp' },
  { name: 'cringe', file: '406566284961120257.webp' },
  { name: 'blank', file: '406566310114230283.webp' },
  { name: 'sideeye', file: '406810593962622988.webp' },
  { name: 'happy', file: '418166535257849866.webp' },
  { name: 'grin', file: '418565953232568360.webp' },
  { name: 'neutral', file: '469907913411133442.webp' },
  { name: 'late', file: '475701017862995968.webp' },
  { name: 'laugh', file: '475701032974811157.webp' },
  { name: 'gasp', file: '475701035369758721.webp' },
  { name: 'wave', file: '503326004027326509.webp' },
  { name: 'oops', file: '503329647124283393.webp' },
  { name: 'stern', file: '503334480329834506.webp' },
  { name: 'sweat', file: '503339616921714716.webp' },
  { name: 'sun', file: '503339639554310154.webp' },
  { name: 'idea', file: '503339640435114015.webp' },
  { name: 'fist', file: '503345026261319681.webp' },
  { name: 'devil', file: '503349492578517004.webp' },
]

export const EMOJI_BY_NAME = new Map(EMOJI.map((e) => [e.name, e]))

export const emojiUrl = (file) => `/emojis/${file}`

// Built from the known names, so a stray colon in ordinary text can't turn
// into an image: "12:00:30" has no emoji called "00", and is left alone.
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const PATTERN = new RegExp(`:(${EMOJI.map((e) => escape(e.name)).join('|')}):`, 'g')

// Splits text into plain strings and emoji descriptors, for a renderer to turn
// into React nodes. Returning data rather than markup keeps this testable and
// keeps the XSS question from ever arising.
export function parseEmoji(text) {
  const parts = []
  let last = 0

  for (const match of text.matchAll(PATTERN)) {
    if (match.index > last) parts.push({ type: 'text', value: text.slice(last, match.index) })
    parts.push({ type: 'emoji', emoji: EMOJI_BY_NAME.get(match[1]) })
    last = match.index + match[0].length
  }

  if (last < text.length) parts.push({ type: 'text', value: text.slice(last) })
  return parts
}
