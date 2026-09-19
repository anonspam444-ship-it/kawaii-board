// Who you are, as far as this board is concerned.
//
// There is no login. The browser asks for a name once, keeps it in
// localStorage, and sends it along with anything you pin. That makes the byline
// a signature rather than an identity claim — anybody can type any name, and
// clearing site data makes you a stranger again. For a board shared between
// friends that is the right amount of ceremony; a real account system would be
// more machinery than the thing is worth.
//
// localStorage rather than a cookie: the name is only ever read by this app's
// own JavaScript to put in a request body, so there is no reason to attach it
// to every request the browser makes.
const KEY = 'kawaii-board.name'

export const MAX_NAME = 40

function read() {
  try {
    return localStorage.getItem(KEY)
  } catch {
    // Private browsing can throw on access. Falling back to "no name yet" keeps
    // the board usable; the prompt just reappears next time.
    return null
  }
}

let name = read()

export const getName = () => name

export const hasName = () => Boolean(name)

// Returns the stored value so callers can use the cleaned-up version directly.
export function setName(value) {
  name = (value ?? '').trim().slice(0, MAX_NAME) || null
  try {
    if (name) localStorage.setItem(KEY, name)
    else localStorage.removeItem(KEY)
  } catch {
    // Keep it in memory for this session; nothing else we can do.
  }
  return name
}

export const clearName = () => setName(null)

// --- "have we said hello yet?" ---------------------------------------------
// Separate from the name itself so that someone who skips the prompt isn't
// asked again on every page load. Pinning still requires a name — the prompt
// comes back at that point, when it has an obvious reason to.
const GREETED_KEY = 'kawaii-board.greeted'

export function hasBeenGreeted() {
  try {
    return localStorage.getItem(GREETED_KEY) === 'true'
  } catch {
    return false
  }
}

export function markGreeted() {
  try {
    localStorage.setItem(GREETED_KEY, 'true')
  } catch {
    // Non-fatal: worst case the greeting shows again next visit.
  }
}
