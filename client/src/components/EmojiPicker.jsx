import { useEffect, useRef } from 'react'
import { EMOJI, emojiUrl } from '../emoji.js'

// The grid that drops out of the composer toolbar.
//
// Closes on Escape or on a click anywhere outside it, which is what people
// expect of a popover and what stops it sitting open over the feed.
export default function EmojiPicker({ onPick, onClose }) {
  const box = useRef(null)

  useEffect(() => {
    function onKey(event) {
      if (event.key === 'Escape') onClose()
    }
    function onDown(event) {
      // The toggle button lives outside this element, so it handles its own
      // click; anything else outside closes.
      if (!box.current?.contains(event.target) && !event.target.closest('.composer__emoji')) {
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [onClose])

  return (
    <div className="picker" ref={box} role="dialog" aria-label="Choose an emoji">
      <div className="picker__grid">
        {EMOJI.map((emoji) => (
          <button
            key={emoji.name}
            type="button"
            className="picker__item"
            // Deliberately not onClick: the composer's textarea would lose
            // focus (and its selection) on mousedown first, so the insertion
            // point would be gone by the time a click landed.
            onMouseDown={(event) => {
              event.preventDefault()
              onPick(emoji)
            }}
            title={`:${emoji.name}:`}
            aria-label={emoji.name}
          >
            <img src={emojiUrl(emoji.file)} alt="" loading="lazy" draggable={false} />
          </button>
        ))}
      </div>
    </div>
  )
}
