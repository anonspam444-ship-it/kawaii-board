import { useEffect, useState } from 'react'
import PixelSprite, {
  MUSHROOM,
  SLIME,
  SNAIL,
  STUMP,
  PIG,
  LEAF,
  LEAF_GOLD,
  HEART,
  SPARKLE,
} from './PixelSprite.jsx'
import '../styles/countdown.css'

// Midnight opening the 6th of October, in whatever timezone the browser is in.
// "October 6th, 12am" was given without a zone, so local is the reading that
// matches the clock on the wall; month is 0-indexed, hence 9.
const RELEASE = new Date(2026, 9, 6, 0, 0, 0, 0)

// How far back the EXP bar starts filling from. Purely cosmetic: a bar that
// only moves in the last month actually visibly moves.
const EXP_WINDOW_DAYS = 30

const secondsUntil = () => Math.max(0, Math.ceil((RELEASE.getTime() - Date.now()) / 1000))

// Scenery. Fixed rather than random so the layout doesn't reshuffle on every
// render (and so hot reload doesn't make the leaves jump).
const CLOUD = {
  legend: { C: '#ffffff', S: '#d6ecff' },
  rows: ['...CCCC...', '.CCCCCCCC.', 'CCCCCCCCCC', 'CCCCCCCCCC', '.SSSSSSSS.'],
}

const CLOUDS = [
  { top: '12%', scale: 1.0, duration: 71, delay: 0 },
  { top: '30%', scale: 0.65, duration: 96, delay: -28 },
  { top: '6%', scale: 0.8, duration: 84, delay: -52 },
]

const LEAVES = [
  { left: '4%', delay: 0, duration: 11, scale: 0.9, gold: false },
  { left: '17%', delay: 3.5, duration: 14, scale: 0.6, gold: true },
  { left: '29%', delay: 7, duration: 9.5, scale: 1.1, gold: false },
  { left: '41%', delay: 1.5, duration: 13, scale: 0.7, gold: true },
  { left: '56%', delay: 5.5, duration: 10.5, scale: 0.95, gold: false },
  { left: '68%', delay: 9, duration: 15, scale: 0.65, gold: true },
  { left: '79%', delay: 2.5, duration: 12, scale: 1.0, gold: false },
  { left: '91%', delay: 6.5, duration: 10, scale: 0.8, gold: true },
]

// The cast, left to right along the grass. `key` drives the per-creature
// animation class; `hideAt` drops the crowd down to three on a phone.
const CAST = [
  { key: 'stump', sprite: STUMP, hideAt: 'sm' },
  { key: 'mushroom', sprite: MUSHROOM },
  { key: 'snail', sprite: SNAIL, hideAt: 'md' },
  { key: 'pig', sprite: PIG },
  { key: 'slime', sprite: SLIME },
]

// Emoticons burbling up out of the grass. Deliberately kept to the outer
// margins: the clock, EXP bar and date line all live in the middle, and a
// face drifting up through them just reads as clutter.
const FACES = [
  { text: ':3', left: '4%', delay: 0, duration: 9 },
  { text: 'x3', left: '14%', delay: 3.4, duration: 11 },
  { text: '^w^', left: '23%', delay: 6.2, duration: 10 },
  { text: 'uwu', left: '77%', delay: 1.6, duration: 12 },
  { text: ':3', left: '87%', delay: 8.1, duration: 9.5 },
  { text: 'x3', left: '95%', delay: 4.7, duration: 10.5 },
]

const HEARTS = [
  { left: '9%', delay: 1.2, duration: 8, scale: 0.8 },
  { left: '81%', delay: 5.5, duration: 9.5, scale: 1 },
  { left: '92%', delay: 3, duration: 7.5, scale: 0.65 },
]

const SPARKLES = [
  { left: '5%', top: '20%', delay: 0, duration: 3.2, scale: 0.8 },
  { left: '15%', top: '48%', delay: 1.1, duration: 2.6, scale: 1 },
  { left: '84%', top: '28%', delay: 2.0, duration: 3.6, scale: 0.7 },
  { left: '93%', top: '14%', delay: 0.6, duration: 3.0, scale: 0.9 },
  { left: '74%', top: '58%', delay: 2.6, duration: 2.8, scale: 0.6 },
]

function Cell({ label, value }) {
  const padded = String(value).padStart(2, '0')
  return (
    <div className="cd__cell">
      {/* Keyed on the value so the pop animation restarts each time it ticks. */}
      <span key={padded} className="cd__value">
        {padded}
      </span>
      <span className="cd__label">{label}</span>
    </div>
  )
}

export default function Countdown() {
  const [left, setLeft] = useState(secondsUntil)

  useEffect(() => {
    // Recomputed from Date.now() rather than decremented, so a sleeping tab or
    // a slow frame can't make the clock drift. Polling faster than 1s keeps the
    // seconds digit honest; `left` is a whole number, so React skips the
    // re-render on the ticks where nothing changed.
    const id = setInterval(() => setLeft(secondsUntil()), 250)
    return () => clearInterval(id)
  }, [])

  const released = left === 0
  const days = Math.floor(left / 86_400)
  const hours = Math.floor(left / 3_600) % 24
  const minutes = Math.floor(left / 60) % 60
  const seconds = left % 60

  const exp = Math.min(100, Math.max(0, (1 - left / (EXP_WINDOW_DAYS * 86_400)) * 100))

  const when = RELEASE.toLocaleString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

  return (
    <section className={`cd${released ? ' cd--released' : ''}`} role="timer">
      <div className="cd__sky" aria-hidden="true">
        {CLOUDS.map((c, i) => (
          <PixelSprite
            key={i}
            {...CLOUD}
            className="cd__cloud"
            style={{
              top: c.top,
              '--cloud-scale': c.scale,
              animationDuration: `${c.duration}s`,
              animationDelay: `${c.delay}s`,
            }}
          />
        ))}

        {LEAVES.map((l, i) => (
          <PixelSprite
            key={i}
            {...(l.gold ? LEAF_GOLD : LEAF)}
            className="cd__leaf"
            style={{
              left: l.left,
              '--leaf-scale': l.scale,
              animationDuration: `${l.duration}s`,
              animationDelay: `${l.delay}s`,
            }}
          />
        ))}
      </div>

      <div className="cd__kawaii" aria-hidden="true">
        {SPARKLES.map((s, i) => (
          <PixelSprite
            key={`s${i}`}
            {...SPARKLE}
            className="cd__sparkle"
            style={{
              left: s.left,
              top: s.top,
              '--sparkle-scale': s.scale,
              animationDuration: `${s.duration}s`,
              animationDelay: `${s.delay}s`,
            }}
          />
        ))}

        {HEARTS.map((h, i) => (
          <PixelSprite
            key={`h${i}`}
            {...HEART}
            className="cd__heart"
            style={{
              left: h.left,
              '--heart-scale': h.scale,
              animationDuration: `${h.duration}s`,
              animationDelay: `${h.delay}s`,
            }}
          />
        ))}

        {FACES.map((f, i) => (
          <span
            key={`f${i}`}
            className="cd__face"
            style={{
              left: f.left,
              animationDuration: `${f.duration}s`,
              animationDelay: `${f.delay}s`,
            }}
          >
            {f.text}
          </span>
        ))}
      </div>

      <div className="cd__content">
        <p className="cd__eyebrow">{released ? 'the portal is open' : 'now loading…'}</p>
        <h2 className="cd__title">
          <span className="cd__title-maple">MAPLESTORY</span>
          <span className="cd__title-classic">CLASSIC</span>
        </h2>

        {released ? (
          <p className="cd__done">MAPLE ISLAND IS OPEN — GO</p>
        ) : (
          <>
            <div className="cd__clock" aria-hidden="true">
              <Cell label="days" value={days} />
              <span className="cd__colon">:</span>
              <Cell label="hours" value={hours} />
              <span className="cd__colon">:</span>
              <Cell label="mins" value={minutes} />
              <span className="cd__colon">:</span>
              <Cell label="secs" value={seconds} />
            </div>

            {/* One quiet sentence for screen readers, instead of four digits
                that would otherwise be re-announced every second. */}
            <p className="visually-hidden">
              {days} days until MapleStory Classic opens.
            </p>

            <div className="cd__exp">
              <span className="cd__exp-tag">EXP</span>
              <div
                className="cd__exp-track"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(exp)}
                aria-label="Progress toward release"
              >
                <div className="cd__exp-fill" style={{ width: `${exp}%` }} />
              </div>
              <span className="cd__exp-pct">{exp.toFixed(2)}%</span>
            </div>
          </>
        )}

        <p className="cd__when">{when} · your local time</p>
      </div>

      {/* Ground line the cast stands on. */}
      <div className="cd__ground" aria-hidden="true" />

      <div className="cd__cast" aria-hidden="true">
        {CAST.map((c) => (
          <PixelSprite
            key={c.key}
            {...c.sprite}
            className={`cd__sprite cd__sprite--${c.key}${c.hideAt ? ` cd__sprite--hide-${c.hideAt}` : ''}`}
          />
        ))}
      </div>
    </section>
  )
}
