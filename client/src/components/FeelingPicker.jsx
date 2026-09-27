import { useEffect, useRef } from 'react'
import { EMOJI, emojiUrl } from '../emoji.js'

// Just the faces. The words used to come from a fixed list here; they're typed
// by the poster now, in the field the composer shows once a face is chosen.
// `mood` survives in emoji.js only as a label for the tooltip and alt text.
export default function FeelingPicker({ selected, onPick, onClear, onClose }) {
  const box = useRef(null)

  useEffect(() => {
    function onKey(event) {
      if (event.key === 'Escape') onClose()
    }
    function onDown(event) {
      if (!box.current?.contains(event.target) && !event.target.closest('.composer__feeling')) {
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
    <div className="picker picker--feeling" ref={box} role="dialog" aria-label="Choose a face">
      <p className="picker__hint">Pick a face</p>

      <div className="picker__grid">
        {EMOJI.map((emoji) => (
          <button
            key={emoji.name}
            type="button"
            className={`picker__item${selected === emoji.name ? ' picker__item--on' : ''}`}
            onClick={() => onPick(emoji.name)}
            aria-pressed={selected === emoji.name}
            title={emoji.mood}
            aria-label={emoji.mood}
          >
            <img src={emojiUrl(emoji.file)} alt="" loading="lazy" draggable={false} />
          </button>
        ))}
      </div>

      {selected && (
        <button type="button" className="picker__clear" onClick={onClear}>
          No face
        </button>
      )}
    </div>
  )
}
