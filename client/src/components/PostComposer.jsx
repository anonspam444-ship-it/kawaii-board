import { useRef, useState } from 'react'
import Avatar from './Avatar.jsx'
import EmojiPicker from './EmojiPicker.jsx'
import { toBoundedDataUrl } from '../lib/image.js'

const MAX_BODY = 500

// The box at the top of the feed. Pictures are downscaled here, before upload —
// see lib/image.js for why.
export default function PostComposer({ name, avatarUrl, onPost, onNeedName }) {
  const [body, setBody] = useState('')
  const [image, setImage] = useState(null) // data URL, already resized
  const [picking, setPicking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const fileInput = useRef(null)
  const textarea = useRef(null)

  const text = body.trim()
  const canSend = Boolean(text || image) && !busy
  const left = MAX_BODY - body.length

  // Drops the shortcode in at the caret rather than appending, and puts the
  // caret after it so you can keep typing. The textarea's maxLength only
  // constrains typing, so the cap is enforced here too.
  function insertEmoji(emoji) {
    const token = `:${emoji.name}:`
    const el = textarea.current
    const start = el?.selectionStart ?? body.length
    const end = el?.selectionEnd ?? start
    const next = body.slice(0, start) + token + body.slice(end)

    if (next.length > MAX_BODY) return
    setBody(next)

    // After React has re-rendered with the new value, put the caret back.
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(start + token.length, start + token.length)
    })
  }

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
      await onPost({ body: text, image })
      setBody('')
      setImage(null)
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
          ref={textarea}
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

        {error && <p className="composer__error">{error}</p>}

        <div className="composer__toolbar">
          <div className="composer__tools">
            <button
              type="button"
              className={`composer__emoji${picking ? ' composer__emoji--on' : ''}`}
              onClick={() => setPicking((v) => !v)}
              aria-expanded={picking}
              title="Insert an emoji"
            >
              <span aria-hidden="true">☺</span> Emoji
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
          <EmojiPicker onPick={insertEmoji} onClose={() => setPicking(false)} />
        )}
      </div>
    </form>
  )
}
