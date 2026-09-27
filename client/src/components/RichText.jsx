import { parseEmoji, emojiUrl } from '../emoji.js'

// Renders post and comment text with :shortcodes: resolved to emoji images.
//
// Builds React nodes from parsed parts rather than assembling an HTML string,
// so nothing a visitor types is ever interpreted as markup. The feed is open
// to anyone, which makes that the difference between a toy and an XSS hole.
export default function RichText({ text, className }) {
  return (
    <span className={className}>
      {parseEmoji(text).map((part, i) =>
        part.type === 'emoji' ? (
          <img
            key={i}
            className="emoji"
            src={emojiUrl(part.emoji.file)}
            alt={`:${part.emoji.name}:`}
            title={`:${part.emoji.name}:`}
            loading="lazy"
            draggable={false}
          />
        ) : (
          part.value
        ),
      )}
    </span>
  )
}
