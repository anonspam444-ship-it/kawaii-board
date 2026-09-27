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
  { name: 'smile', mood: 'Fine', file: '1353909602424717392.webp' },
  { name: 'dog', mood: 'Loyal', file: '1539300842149253290.webp' },
  { name: 'worried', mood: 'Worried', file: '406565199273787412.webp' },
  { name: 'rude', mood: 'Done', file: '406565298611945472.webp' },
  { name: 'unamused', mood: 'Unamused', file: '406566105478332436.webp' },
  { name: 'facepalm', mood: 'Over It', file: '406566224827383809.webp' },
  { name: 'cringe', mood: 'Cringe', file: '406566284961120257.webp' },
  { name: 'blank', mood: 'Blank', file: '406566310114230283.webp' },
  { name: 'sideeye', mood: 'Suspicious', file: '406810593962622988.webp' },
  { name: 'happy', mood: 'Happy', file: '418166535257849866.webp' },
  { name: 'grin', mood: 'Pleased', file: '418565953232568360.webp' },
  { name: 'neutral', mood: 'Neutral', file: '469907913411133442.webp' },
  { name: 'late', mood: 'Late', file: '475701017862995968.webp' },
  { name: 'laugh', mood: 'Amused', file: '475701032974811157.webp' },
  { name: 'gasp', mood: 'Shook', file: '475701035369758721.webp' },
  { name: 'wave', mood: 'Friendly', file: '503326004027326509.webp' },
  { name: 'oops', mood: 'Embarrassed', file: '503329647124283393.webp' },
  { name: 'stern', mood: 'Stern', file: '503334480329834506.webp' },
  { name: 'sweat', mood: 'Nervous', file: '503339616921714716.webp' },
  { name: 'sun', mood: 'Radiant', file: '503339639554310154.webp' },
  { name: 'idea', mood: 'Smart', file: '503339640435114015.webp' },
  { name: 'fist', mood: 'Ready', file: '503345026261319681.webp' },
  { name: 'devil', mood: 'Evil', file: '503349492578517004.webp' },
]

export const EMOJI_BY_NAME = new Map(EMOJI.map((e) => [e.name, e]))

// A post carries one of these as its feeling. `mood` is the word shown beside
// the picture ("FEELING: Smart"); `name` is what's stored, so the wording can
// change without rewriting any rows.
export const moodFor = (name) => EMOJI_BY_NAME.get(name) ?? null

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
