import { useRef, useState } from 'react'
import Avatar from './Avatar.jsx'
import FeelingPicker from './FeelingPicker.jsx'
import { emojiUrl, moodFor } from '../emoji.js'
import { toBoundedDataUrl } from '../lib/image.js'

const MAX_BODY = 500

// The box at the top of the feed. Pictures are downscaled here, before upload —
// see lib/image.js for why.
export default function PostComposer({ name, avatarUrl, onPost, onNeedName }) {
  const [body, setBody] = useState('')
  const [image, setImage] = useState(null) // data URL, already resized
  const [feeling, setFeeling] = useState(null) // emoji name, or null
  const [feelingText, setFeelingText] = useState('')
  const [picking, setPicking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const fileInput = useRef(null)

  const chosen = moodFor(feeling)
  const text = body.trim()
  const mood = feelingText.trim()
  const canSend = Boolean(text || image || feeling || mood) && !busy
  const left = MAX_BODY - body.length

  async function pick(event) {
    const file = event.target.files?.[0]
    // Reset immediately so re-picking the same file fires onChange again.
    event.target.value = ''
    if (!file) return

    setError(null)
    try {
      setImage(await toBoundedDataUrl(file))
    } catch (e) {
      setError(e.message)
    }
  }

  async function submit(event) {
    event.preventDefault()
    if (!canSend) return

    // Posting is what makes a name necessary — nobody needs one to read.
    if (!name) return onNeedName()

    setBusy(true)
    setError(null)
    try {
      await onPost({ body: text, image, feeling, feelingText: mood })
      setBody('')
      setImage(null)
      setFeeling(null)
      setFeelingText('')
      setPicking(false)
    } catch (e) {
      setError(e.message) // keep the draft so it can be retried
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="composer" onSubmit={submit}>
      <Avatar name={name} url={avatarUrl} size={44} className="composer__avatar" />

      <div className="composer__main">
        <textarea
          className="composer__input"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={name ? "What's happening?" : 'Say something…'}
          maxLength={MAX_BODY}
          rows={2}
          aria-label="What's happening?"
        />

        {image && (
          <div className="composer__preview">
            <img src={image} alt="Attached" />
            <button
              type="button"
              className="composer__drop"
              onClick={() => setImage(null)}
              aria-label="Remove picture"
              title="Remove picture"
            >
              ×
            </button>
          </div>
        )}

        {(chosen || mood) && (
          <div className="feeling-input">
            <label className="feeling-input__label" htmlFor="feeling-text">
              Feeling
            </label>
            {chosen && (
              <img className="feeling-input__face" src={emojiUrl(chosen.file)} alt={chosen.mood} />
            )}
            <input
              id="feeling-text"
              className="feeling-input__field"
              value={feelingText}
              onChange={(e) => setFeelingText(e.target.value)}
              placeholder="how are you feeling?"
              maxLength={40}
            />
            <button
              type="button"
              className="feeling-input__drop"
              onClick={() => {
                setFeeling(null)
                setFeelingText('')
              }}
              aria-label="Remove feeling"
              title="Remove feeling"
            >
              ×
            </button>
          </div>
        )}

        {error && <p className="composer__error">{error}</p>}

        <div className="composer__toolbar">
          <div className="composer__tools">
            <button
              type="button"
              className={`composer__feeling${picking ? ' composer__feeling--on' : ''}`}
              onClick={() => setPicking((v) => !v)}
              aria-expanded={picking}
              title="Set how you're feeling"
            >
              {chosen ? (
                <img className="emoji" src={emojiUrl(chosen.file)} alt={chosen.mood} />
              ) : (
                <>
                  <span aria-hidden="true">☺</span> Feeling
                </>
              )}
            </button>

            <button
              type="button"
              className="composer__attach"
              onClick={() => fileInput.current?.click()}
              title="Add a picture"
            >
              <span aria-hidden="true">📷</span> {image ? 'Change picture' : 'Picture'}
            </button>

            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              className="visually-hidden"
              onChange={pick}
              tabIndex={-1}
            />
          </div>

          {/* Only nags once it's close, rather than counting at you the whole time. */}
          {left < 100 && (
            <span className={`composer__count${left < 0 ? ' composer__count--over' : ''}`}>
              {left}
            </span>
          )}

          <button type="submit" className="composer__send" disabled={!canSend}>
            {busy ? 'Posting…' : 'Post'}
          </button>
        </div>

        {picking && (
          <FeelingPicker
            selected={feeling}
            onPick={(name) => {
              setFeeling(name)
              setPicking(false)
            }}
            onClear={() => {
              setFeeling(null)
              setPicking(false)
            }}
            onClose={() => setPicking(false)}
          />
        )}
      </div>
    </form>
  )
}
