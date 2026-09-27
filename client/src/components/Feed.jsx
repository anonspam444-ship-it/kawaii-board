import { useEffect, useState } from 'react'
import PostComposer from './PostComposer.jsx'
import PostCard from './PostCard.jsx'
import {
  getFeed,
  createPost,
  deletePost,
  togglePostLike,
  createComment,
  deleteComment,
} from '../api.js'
import { getClientId } from '../identity.js'
import '../styles/feed.css'

// One shared timeline, open to everyone. Keeps its own state and its own error
// line rather than routing through App: a failed like shouldn't put a banner
// over the quest board, and the board's errors shouldn't appear down here.
export default function Feed({ name, avatarUrl, canModerate, onNeedName }) {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  function load() {
    getFeed()
      .then((data) => {
        setPosts(data)
        setError(null)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  async function handlePost({ body, image }) {
    const created = await createPost({ body, image })
    // The server doesn't echo the author back (the browser already knows who it
    // is), so it's filled in here to avoid a refetch just to render one card.
    setPosts((prev) => [
      {
        ...created,
        author: { client_id: getClientId(), name, avatar_url: avatarUrl },
        comments: [],
      },
      ...prev,
    ])
  }

  async function handleDeletePost(id) {
    const snapshot = posts
    setPosts((prev) => prev.filter((p) => p.id !== id)) // optimistic
    try {
      await deletePost(id)
    } catch (e) {
      setError(e.message)
      setPosts(snapshot)
    }
  }

  async function handleLike(id) {
    // Flip immediately — a like that waits for the network feels broken.
    setPosts((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, liked_by_me: !p.liked_by_me, likes: p.likes + (p.liked_by_me ? -1 : 1) }
          : p,
      ),
    )
    try {
      const { likes, liked_by_me } = await togglePostLike(id)
      // Then take the server's count, which is authoritative once other people
      // are liking the same post.
      setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, likes, liked_by_me } : p)))
    } catch (e) {
      setError(e.message)
      load() // our guess may now be wrong in either direction
    }
  }

  async function handleComment(postId, body) {
    try {
      const comment = await createComment(postId, body)
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                comments: [
                  ...p.comments,
                  {
                    ...comment,
                    author: { client_id: getClientId(), name, avatar_url: avatarUrl },
                  },
                ],
              }
            : p,
        ),
      )
    } catch (e) {
      setError(e.message)
      throw e // PostCard keeps the draft
    }
  }

  async function handleDeleteComment(postId, commentId) {
    const snapshot = posts
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, comments: p.comments.filter((c) => c.id !== commentId) } : p,
      ),
    )
    try {
      await deleteComment(postId, commentId)
    } catch (e) {
      setError(e.message)
      setPosts(snapshot)
    }
  }

  return (
    <section className="feed" aria-labelledby="feed-title">
      <h2 className="feed__title" id="feed-title">
        The Feed
      </h2>
      <p className="feed__blurb">Anyone can post. Be nice, or don't.</p>

      <PostComposer
        name={name}
        avatarUrl={avatarUrl}
        onPost={handlePost}
        onNeedName={onNeedName}
      />

      {error && <p className="feed__error">⚠ {error}</p>}

      {loading ? (
        <p className="feed__empty">Loading the feed…</p>
      ) : posts.length === 0 ? (
        <p className="feed__empty">Nothing here yet. Be the first.</p>
      ) : (
        <ul className="feed__posts">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              canModerate={canModerate}
              hasName={Boolean(name)}
              onNeedName={onNeedName}
              onLike={handleLike}
              onComment={handleComment}
              onDeletePost={handleDeletePost}
              onDeleteComment={handleDeleteComment}
            />
          ))}
        </ul>
      )}
    </section>
  )
}
