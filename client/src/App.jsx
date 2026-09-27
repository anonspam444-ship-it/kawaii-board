import { Fragment, useEffect, useState } from 'react'
import Column from './components/Column.jsx'
import UnlockBar from './components/UnlockBar.jsx'
import Countdown from './components/Countdown.jsx'
import StreakPanel from './components/StreakPanel.jsx'
import NamePrompt from './components/NamePrompt.jsx'
import Feed from './components/Feed.jsx'
import Avatar from './components/Avatar.jsx'
import AdminPanel from './components/AdminPanel.jsx'
import Toasts from './components/Toasts.jsx'
import { useNotifications } from './lib/notifications.js'
import {
  getEntries,
  createEntry,
  updateEntry,
  deleteEntry,
  unlock,
  getStreak,
  checkInStreak,
  resetStreak,
  unlockStreak,
  saveProfile,
  getProfile,
  logVisit,
  isMock,
} from './api.js'
import { clearToken, hasToken, clearStreakToken, hasStreakToken } from './auth.js'
import {
  getName,
  setName,
  hasName,
  wasDismissed,
  markDismissed,
  getAvatarUrl,
  setAvatarUrl,
} from './identity.js'
import './styles/board.css'

// Add more lists here later (each needs matching theme styles + placeholders).
const LISTS = [
  { key: 'worth', title: 'Worth List', theme: 'worth' },
  { key: 'worst', title: 'Worst List', theme: 'worst' },
]

export default function App() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  // Mock mode has no server to authenticate against, so it's always editable.
  const [unlocked, setUnlocked] = useState(() => isMock || hasToken())

  const [streak, setStreak] = useState(null)
  const [streakLoading, setStreakLoading] = useState(true)
  const [streakUnlocked, setStreakUnlocked] = useState(() => isMock || hasStreakToken())

  const [name, setNameValue] = useState(getName)
  const [avatarUrl, setAvatarUrlValue] = useState(getAvatarUrl)
  // null | 'greet' (dismissible, first visit) | 'required' (tried to post unnamed)
  const [prompt, setPrompt] = useState(null)
  // The visit log lives at #admin and is never linked to. See AdminPanel.
  const [showAdmin, setShowAdmin] = useState(() => location.hash === '#admin')

  // Bumped whenever the notification poll reports activity, which makes the
  // feed reload — so somebody else's new post appears on its own.
  const [feedRefresh, setFeedRefresh] = useState(0)

  // Paused on the admin screen: it isn't the board, and toasts about the feed
  // sliding over a log you're reading is just in the way.
  const { toasts, dismiss } = useNotifications(!showAdmin && !isMock, () =>
    setFeedRefresh((n) => n + 1),
  )

  function load() {
    setLoading(true)
    getEntries()
      .then((data) => {
        setEntries(data)
        setError(null)
      })
      .catch((e) => {
        // Only reachable with REQUIRE_AUTH_FOR_READS=true on the server.
        if (e.status === 401) setUnlocked(false)
        setError(e.message)
      })
      .finally(() => setLoading(false))
  }

  function loadStreak() {
    setStreakLoading(true)
    getStreak()
      .then(setStreak)
      .catch((e) => {
        // A missing streak table shouldn't blank out the board, so this failure
        // is reported in the banner and the panel stays on screen at zero.
        if (e.status !== 401) setError(e.message)
      })
      .finally(() => setStreakLoading(false))
  }

  useEffect(() => {
    load()
    loadStreak()
    logVisit()

    // Asked on every load until a name exists — see identity.js for why the
    // dismissal is no longer remembered across visits.
    if (!hasName() && !wasDismissed()) setPrompt('greet')

    // The avatar URL is only cached locally; the profile row is the truth. A
    // browser that kept its client id but lost the cache (or uploaded a
    // picture on another device) gets it back here.
    if (!getAvatarUrl()) {
      getProfile()
        .then((profile) => {
          if (profile?.avatar_url) setAvatarUrlValue(setAvatarUrl(profile.avatar_url))
          // A profile with a name we don't have locally means this browser
          // cleared its name but not its id; adopt the stored one.
          if (profile?.name && !hasName()) setNameValue(setName(profile.name))
        })
        .catch(() => {}) // 404 just means they've never saved one
    }

    const onHash = () => setShowAdmin(location.hash === '#admin')
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // --- identity -------------------------------------------------------------
  // Saving goes to the server now, because an avatar other people can see has
  // to live somewhere they can reach. The local copies are updated from the
  // server's response so the stored URL is always one that actually resolves.
  async function handleSaveName({ name: value, avatar, removeAvatar }) {
    const profile = await saveProfile({ name: value, avatar, removeAvatar })
    setNameValue(setName(profile?.name ?? value))
    setAvatarUrlValue(setAvatarUrl(profile?.avatar_url ?? null))
    setPrompt(null)
  }

  function handleSkipName() {
    markDismissed()
    setPrompt(null)
  }

  // --- board ----------------------------------------------------------------
  async function handleUnlock(passphrase) {
    setError(null)
    try {
      await unlock(passphrase)
      setUnlocked(true)
      load() // in case reads were gated too and the board is still empty
    } catch (e) {
      setError(e.message)
      throw e // UnlockBar keeps its box open to retry
    }
  }

  function handleLock() {
    clearToken()
    setUnlocked(false)
    setError(null)
  }

  async function handleAdd(text, list) {
    setError(null)

    // Nothing goes up unsigned. Throwing leaves the typed text in the form, so
    // once a name is given the same entry is one click away.
    if (!hasName()) {
      setPrompt('required')
      throw new Error('name required')
    }

    try {
      const entry = await createEntry(text, list, getName())
      setEntries((prev) => [...prev, entry])
    } catch (e) {
      if (e.status === 401) setUnlocked(false)
      setError(e.message)
      throw e // AddForm keeps the text so it can be retried
    }
  }

  // `patch` is { text?, author? } — the inline editor sends both.
  async function handleEdit(id, patch) {
    setError(null)
    const snapshot = entries
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e))) // optimistic
    try {
      const updated = await updateEntry(id, patch)
      // Trust the server's copy when it sends one (it trims the values).
      if (updated) setEntries((prev) => prev.map((e) => (e.id === id ? updated : e)))
    } catch (e) {
      if (e.status === 401) setUnlocked(false)
      setError(e.message)
      setEntries(snapshot) // roll back on failure
      throw e // Entry stays in edit mode so the change isn't lost
    }
  }

  async function handleDelete(id) {
    const snapshot = entries
    setEntries((prev) => prev.filter((e) => e.id !== id)) // optimistic
    try {
      await deleteEntry(id)
    } catch (e) {
      if (e.status === 401) setUnlocked(false)
      setError(e.message)
      setEntries(snapshot) // roll back on failure
    }
  }

  // --- streak ---------------------------------------------------------------
  async function handleStreakUnlock(passphrase) {
    setError(null)
    try {
      await unlockStreak(passphrase)
      setStreakUnlocked(true)
    } catch (e) {
      setError(e.message)
      throw e // StreakPanel keeps its box open to retry
    }
  }

  function handleStreakLock() {
    clearStreakToken()
    setStreakUnlocked(false)
    setError(null)
  }

  // Both writes take the server's returned row as the truth rather than
  // guessing locally: the server owns the once-a-day rule and the best-ever
  // number, so its copy is the one that's right.
  async function runStreakWrite(action) {
    setError(null)
    try {
      setStreak(await action())
    } catch (e) {
      if (e.status === 401) setStreakUnlocked(false)
      // A 409 means the day was already counted — refresh so the panel shows
      // the real state rather than staying on a stale "not yet today".
      if (e.status === 409) loadStreak()
      setError(e.message)
      throw e
    }
  }

  const handleCheckIn = () => runStreakWrite(() => checkInStreak())
  const handleStreakReset = () => runStreakWrite(() => resetStreak())

  if (showAdmin) {
    return (
      <AdminPanel
        onClose={() => {
          location.hash = ''
          setShowAdmin(false)
        }}
      />
    )
  }

  return (
    <div className="board">
      <div className="board__frame">
        <header className="board__header">
          <h1 className="board__title">WORTHLESS or NOXIST</h1>

          <p className="board__signature">
            {name ? (
              <>
                <Avatar name={name} url={avatarUrl} size={24} className="board__avatar" />
                signed as <strong>{name}</strong>
                <button
                  type="button"
                  className="board__signature-btn"
                  onClick={() => setPrompt('greet')}
                >
                  change
                </button>
              </>
            ) : (
              <button
                type="button"
                className="board__signature-btn"
                onClick={() => setPrompt('greet')}
              >
                add your name
              </button>
            )}
          </p>

          {!isMock && (
            <UnlockBar unlocked={unlocked} onUnlock={handleUnlock} onLock={handleLock} />
          )}
        </header>

        {error && <p className="board__error">⚠ {error}</p>}

        <Countdown />

        <StreakPanel
          streak={streak}
          loading={streakLoading}
          unlocked={streakUnlocked}
          onUnlock={handleStreakUnlock}
          onLock={handleStreakLock}
          onCheckIn={handleCheckIn}
          onReset={handleStreakReset}
        />

        <div className="board__columns">
          {LISTS.map((l, i) => (
            <Fragment key={l.key}>
              {i > 0 && <div className="board__divider" aria-hidden="true" />}
              <Column
                theme={l.theme}
                title={l.title}
                loading={loading}
                canEdit={unlocked}
                entries={entries.filter((e) => e.list === l.key)}
                onAdd={(text) => handleAdd(text, l.key)}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            </Fragment>
          ))}
        </div>

        <Feed
          name={name}
          avatarUrl={avatarUrl}
          onNeedName={() => setPrompt('required')}
          refresh={feedRefresh}
        />
      </div>

      <Toasts toasts={toasts} onDismiss={dismiss} />

      {prompt && (
        <NamePrompt
          initialName={name ?? ''}
          initialAvatarUrl={avatarUrl}
          required={prompt === 'required'}
          onSave={handleSaveName}
          onSkip={handleSkipName}
        />
      )}
    </div>
  )
}
