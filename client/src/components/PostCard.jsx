import { useRef, useState } from 'react'
import Avatar from './Avatar.jsx'
import EmojiPicker from './EmojiPicker.jsx'
import RichText from './RichText.jsx'

const MAX_COMMENT = 300

// Relative time, because "2h" is what you want on a feed. Falls back to a real
// date once it stops being recent, where the exact day matters more than "43d".
function when(iso) {
  const then = new Date(iso)
  const seconds = Math.floor((Date.now() - then.getTime()) / 1000)

  if (seconds < 45) return 'just now'
  if (seconds < 90) return '1m'
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  if (seconds < 86_400) return `${Math.round(seconds / 3600)}h`
  if (seconds < 604_800) return `${Math.round(seconds / 86_400)}d`
  return then.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const displayName = (author) => author?.name?.trim() || 'someone'

function Comment({ comment, canModerate, onDelete }) {
  return (
    <li className="comment">
      <Avatar name={displayName(comment.author)} url={comment.author?.avatar_url} size={28} />
      <div className="comment__body">
        <p className="comment__meta">
          <strong>{displayName(comment.author)}</strong>
          <span className="comment__time">{when(comment.created_at)}</span>
        </p>
        <RichText className="comment__text" text={comment.body} />
      </div>
      {(comment.mine || canModerate) && (
        <button
          type="button"
          className="comment__delete"
          onClick={() => onDelete(comment.id)}
          aria-label="Delete comment"
          title="Delete comment"
        >
          ×
        </button>
      )}
    </li>
  )
}

export default function PostCard({
  post,
  canModerate,
  onLike,
  onComment,
  onDeletePost,
  onDeleteComment,
  onNeedName,
  hasName,
}) {
  // Threads stay closed until asked for, so a long feed doesn't open as a wall
  // of replies — but a post you just commented on keeps them visible.
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [picking, setPicking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const replyInput = useRef(null)

  const count = post.comments.length

  // Same caret-aware insertion as the composer; see PostComposer for why the
  // picker fires on mousedown rather than click.
  function insertEmoji(emoji) {
    const token = `:${emoji.name}:`
    const el = replyInput.current
    const start = el?.selectionStart ?? draft.length
    const end = el?.selectionEnd ?? start
    const next = draft.slice(0, start) + token + draft.slice(end)

    if (next.length > MAX_COMMENT) return
    setDraft(next)

    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(start + token.length, start + token.length)
    })
  }

  async function submitComment(event) {
    event.preventDefault()
    const text = draft.trim()
    if (!text || busy) return
    if (!hasName) return onNeedName()

    setBusy(true)
    try {
      await onComment(post.id, text)
      setDraft('')
      setPicking(false)
    } catch {
      // Feed surfaces the error banner; keep the draft.
    } finally {
      setBusy(false)
    }
  }

  function like() {
    if (!hasName) return onNeedName()
    onLike(post.id)
  }

  return (
    <li className="post">
      <div className="post__head">
        <Avatar name={displayName(post.author)} url={post.author?.avatar_url} size={40} />
        <div className="post__who">
          <p className="post__name">{displayName(post.author)}</p>
          <p className="post__time">
            <time dateTime={post.created_at} title={new Date(post.created_at).toLocaleString()}>
              {when(post.created_at)}
            </time>
          </p>
        </div>

        {(post.mine || canModerate) &&
          (confirming ? (
            <span className="post__confirm">
              <button type="button" className="post__danger" onClick={() => onDeletePost(post.id)}>
                Delete
              </button>
              <button type="button" className="post__quiet" onClick={() => setConfirming(false)}>
                Cancel
              </button>
            </span>
          ) : (
            <button
              type="button"
              className="post__menu"
              onClick={() => setConfirming(true)}
              aria-label="Delete post"
              title="Delete post"
            >
              ×
            </button>
          ))}
      </div>

      {post.body && <RichText className="post__body" text={post.body} />}

      {post.image_url && (
        <a className="post__image" href={post.image_url} target="_blank" rel="noreferrer">
          <img src={post.image_url} alt="" loading="lazy" />
        </a>
      )}

      <div className="post__bar">
        <button
          type="button"
          className={`post__like${post.liked_by_me ? ' post__like--on' : ''}`}
          onClick={like}
          aria-pressed={post.liked_by_me}
        >
          {post.liked_by_me ? '♥' : '♡'} {post.likes > 0 && post.likes}
        </button>

        <button type="button" className="post__reply" onClick={() => setOpen((v) => !v)}>
          💬 {count > 0 ? count : 'Reply'}
        </button>
      </div>

      {open && (
        <div className="post__thread">
          {count > 0 && (
            <ul className="post__comments">
              {post.comments.map((comment) => (
                <Comment
                  key={comment.id}
                  comment={comment}
                  canModerate={canModerate}
                  onDelete={(id) => onDeleteComment(post.id, id)}
                />
              ))}
            </ul>
          )}

          <form className="comment-form" onSubmit={submitComment}>
            <input
              ref={replyInput}
              className="comment-form__input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Write a reply…"
              maxLength={MAX_COMMENT}
              aria-label="Write a reply"
            />
            <button
              type="button"
              className={`composer__emoji comment-form__emoji${picking ? ' composer__emoji--on' : ''}`}
              onClick={() => setPicking((v) => !v)}
              aria-expanded={picking}
              aria-label="Insert an emoji"
              title="Insert an emoji"
            >
              <span aria-hidden="true">☺</span>
            </button>
            <button type="submit" className="comment-form__send" disabled={busy || !draft.trim()}>
              {busy ? '…' : 'Reply'}
            </button>

            {picking && <EmojiPicker onPick={insertEmoji} onClose={() => setPicking(false)} />}
          </form>
        </div>
      )}
    </li>
  )
}
