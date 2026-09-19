import { useState } from 'react'
import { localToday } from '../api.js'
import '../styles/streak.css'

// Drawn rather than an emoji, so the blood matches the panel's palette and the
// blade can drip on its own schedule.
function BloodyKnife() {
  return (
    <svg className="streak__knife" viewBox="0 0 44 152" aria-hidden="true" focusable="false">
      {/* handle */}
      <rect x="15" y="4" width="14" height="8" rx="3" fill="#1b0f0e" />
      <rect x="16" y="10" width="12" height="30" rx="3" fill="#2a1714" />
      <rect x="18" y="13" width="3" height="24" fill="#3d2420" />
      {/* guard */}
      <rect x="9" y="39" width="26" height="6" rx="2" fill="#6a6a70" />
      <rect x="9" y="39" width="26" height="2" fill="#9a9aa2" />
      {/* blade */}
      <polygon points="15,45 29,45 27,118 22,142 17,118" fill="#b9bcc4" />
      <polygon points="15,45 20,45 19,120 17,118" fill="#e6e9ef" />
      <polygon points="27,118 29,45 29,45 27,118" fill="#8b8f98" />
      {/* blood along the edge, pooling toward the point */}
      <polygon points="21,62 27,58 27,118 22,142 20,120" fill="#8f1010" opacity="0.9" />
      <polygon points="22,96 26,92 26,117 22,136 21,117" fill="#c81616" opacity="0.85" />
      {/* a drop letting go of the tip */}
      <ellipse className="streak__knife-drop" cx="22" cy="146" rx="2.6" ry="4" fill="#c81616" />
    </svg>
  )
}

// The no-contact counter. One person's, hence its own passphrase — holding the
// board passphrase doesn't get you in here, and vice versa.
//
// A day is counted by hand rather than derived from a start date: the daily
// "did you?" is the point of the thing, and answering it is the ritual. The
// server allows one count per calendar day and refuses a second.
export default function StreakPanel({
  streak,
  loading,
  unlocked,
  onUnlock,
  onLock,
  onCheckIn,
  onReset,
}) {
  const [opening, setOpening] = useState(false)
  const [pass, setPass] = useState('')
  const [busy, setBusy] = useState(false)
  // Resetting throws away a real streak, so it takes two deliberate taps.
  const [confirmingReset, setConfirmingReset] = useState(false)

  const count = streak?.count ?? 0
  const best = streak?.best ?? 0
  const countedToday = Boolean(streak) && streak.last_check_in === localToday()

  async function submitPass(e) {
    e.preventDefault()
    if (!pass || busy) return
    setBusy(true)
    try {
      await onUnlock(pass)
      setPass('')
      setOpening(false)
    } catch {
      // App surfaces the error banner; leave the box open to retry.
    } finally {
      setBusy(false)
    }
  }

  async function run(action) {
    if (busy) return
    setBusy(true)
    try {
      await action()
      setConfirmingReset(false)
    } catch {
      // App surfaces the error banner.
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="streak" aria-labelledby="streak-title">
      {/* Three claw slashes raked across the panel. */}
      <div className="streak__claws" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      {/* Blood seeping in along the top edge. */}
      <div className="streak__seep" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>

      <div className="streak__splatter" aria-hidden="true" />

      <BloodyKnife />

      <div className="streak__inner">
        <div className="streak__count-block">
          <p className="streak__eyebrow" id="streak-title">
            days since self-harm
          </p>

          <p className="streak__count">
            {loading ? (
              <span className="streak__count-loading">··</span>
            ) : (
              <>
                <span key={count} className="streak__count-num">
                  {count}
                </span>
                {/* Blood running off the bottom of the digits. */}
                <span className="streak__drip" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
              </>
            )}
          </p>

          <p className="streak__best">
            longest run · <strong>{best}</strong>
          </p>
        </div>

        <div className="streak__controls">
          {!unlocked ? (
            opening ? (
              <form className="streak__form" onSubmit={submitPass}>
                <input
                  className="streak__input"
                  type="password"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  onKeyDown={(e) => e.key === 'Escape' && setOpening(false)}
                  placeholder="passphrase"
                  aria-label="Streak passphrase"
                  autoComplete="current-password"
                  autoFocus
                />
                <button type="submit" className="streak__btn" disabled={busy || !pass}>
                  {busy ? '…' : 'Enter'}
                </button>
                <button
                  type="button"
                  className="streak__btn streak__btn--quiet"
                  onClick={() => {
                    setOpening(false)
                    setPass('')
                  }}
                >
                  Cancel
                </button>
              </form>
            ) : (
              <button
                type="button"
                className="streak__btn streak__btn--big"
                onClick={() => setOpening(true)}
              >
                🔒 It's me
              </button>
            )
          ) : countedToday ? (
            <>
              <p className="streak__prompt streak__prompt--done">
                ✓ Today's already counted. Come back tomorrow.
              </p>
              <div className="streak__row">
                {confirmingReset ? (
                  <>
                    <span className="streak__warn">Back to zero. Sure?</span>
                    <button
                      type="button"
                      className="streak__btn streak__btn--kill"
                      disabled={busy}
                      onClick={() => run(onReset)}
                    >
                      Do it
                    </button>
                    <button
                      type="button"
                      className="streak__btn streak__btn--quiet"
                      onClick={() => setConfirmingReset(false)}
                    >
                      No
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="streak__btn streak__btn--quiet"
                    onClick={() => setConfirmingReset(true)}
                  >
                    Actually, I slipped
                  </button>
                )}
                <button
                  type="button"
                  className="streak__btn streak__btn--quiet"
                  onClick={onLock}
                >
                  Lock
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="streak__prompt">Did you self-harm today?</p>
              <p className="streak__hint">checking his socials counts</p>

              {confirmingReset ? (
                <div className="streak__row">
                  <span className="streak__warn">
                    This puts {count} {count === 1 ? 'day' : 'days'} back to zero.
                  </span>
                  <button
                    type="button"
                    className="streak__btn streak__btn--kill"
                    disabled={busy}
                    onClick={() => run(onReset)}
                  >
                    Do it
                  </button>
                  <button
                    type="button"
                    className="streak__btn streak__btn--quiet"
                    onClick={() => setConfirmingReset(false)}
                  >
                    Never mind
                  </button>
                </div>
              ) : (
                <div className="streak__row">
                  <button
                    type="button"
                    className="streak__btn streak__btn--strong"
                    disabled={busy || loading}
                    onClick={() => run(onCheckIn)}
                  >
                    No — +1 day
                  </button>
                  <button
                    type="button"
                    className="streak__btn streak__btn--kill"
                    disabled={busy || loading}
                    onClick={() => setConfirmingReset(true)}
                  >
                    Yes — reset
                  </button>
                  <button
                    type="button"
                    className="streak__btn streak__btn--quiet"
                    onClick={onLock}
                  >
                    Lock
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  )
}
