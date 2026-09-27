import { useState } from 'react'
import Avatar from './Avatar.jsx'
import RichText from './RichText.jsx'
import { emojiUrl, moodFor } from '../emoji.js'

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

function Comment({ comment, onDelete }) {
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
      {comment.mine && (
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
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const count = post.comments.length
  // Unknown or removed emoji keys resolve to null and simply don't render.
  const face = moodFor(post.feeling)
  const said = post.feeling_text?.trim()
  // Either half is enough to show the line; neither means no line at all.
  const hasFeeling = Boolean(face || said)

  async function submitComment(event) {
    event.preventDefault()
    const text = draft.trim()
    if (!text || busy) return
    if (!hasName) return onNeedName()

    setBusy(true)
    try {
      await onComment(post.id, text)
      setDraft('')
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

  // Who liked it, for the button's tooltip. Long lists get truncated rather
  // than producing a tooltip nobody can read; likers with no saved profile
  // are already filtered out server-side, so the count can exceed this list.
  function likeTooltip() {
    const names = post.liked_by ?? []
    if (!names.length) return post.likes > 0 ? `${post.likes} likes` : 'Like this'
    const shown = names.slice(0, 12).join(', ')
    const rest = names.length - 12
    return rest > 0 ? `${shown} and ${rest} more` : shown
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

        {post.mine &&
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

      {hasFeeling && (
        <p className="feeling">
          <span className="feeling__label">Feeling:</span>
          {/* Their words, not a preset. Omitted entirely rather than rendered
              empty when they only picked a face — an empty flex: 1 span would
              shove the emoji to the far edge with nothing in between. */}
          {said && <span className="feeling__mood">{said}</span>}
          {face && (
            <img className="feeling__face" src={emojiUrl(face.file)} alt={face.mood} />
          )}
        </p>
      )}

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
          title={likeTooltip()}
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
                  onDelete={(id) => onDeleteComment(post.id, id)}
                />
              ))}
            </ul>
          )}

          <form className="comment-form" onSubmit={submitComment}>
            <input
              className="comment-form__input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Write a reply…"
              maxLength={MAX_COMMENT}
              aria-label="Write a reply"
            />
            <button type="submit" className="comment-form__send" disabled={busy || !draft.trim()}>
              {busy ? '…' : 'Reply'}
            </button>

          </form>
        </div>
      )}
    </li>
  )
}
