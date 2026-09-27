import { useEffect, useRef } from 'react'
import { EMOJI, emojiUrl } from '../emoji.js'

// Pick one feeling for the post. Unlike the old inline picker, this doesn't
// insert anything into the text — the choice is a property of the post, shown
// on its own line underneath, the way TheSlap did it.
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
    <div className="picker picker--feeling" ref={box} role="dialog" aria-label="Choose a feeling">
      <p className="picker__hint">How are you feeling?</p>

      <div className="picker__moods">
        {EMOJI.map((emoji) => (
          <button
            key={emoji.name}
            type="button"
            className={`mood${selected === emoji.name ? ' mood--on' : ''}`}
            onClick={() => onPick(emoji.name)}
            aria-pressed={selected === emoji.name}
          >
            <img src={emojiUrl(emoji.file)} alt="" loading="lazy" draggable={false} />
            <span className="mood__word">{emoji.mood}</span>
          </button>
        ))}
      </div>

      {selected && (
        <button type="button" className="picker__clear" onClick={onClear}>
          No feeling
        </button>
      )}
    </div>
  )
}
