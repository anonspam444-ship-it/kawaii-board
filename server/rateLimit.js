// Fixed-window per-IP rate limiting.
//
// In-memory, so it's per-process: it resets on restart and doesn't coordinate
// across replicas. That's the same trade the passphrase throttle in auth.js
// makes, and it's the right one here — the feed is open to anyone, so the point
// is to blunt a burst from one source, not to be an airtight quota system. Put
// something real in front if this ever gets popular.
export function rateLimit({ name, max, windowMs, message }) {
  const hits = new Map() // ip -> { count, expires }

  function sweep(now) {
    for (const [ip, record] of hits) {
      if (record.expires <= now) hits.delete(ip)
    }
  }

  return function limiter(req, res, next) {
    const now = Date.now()
    const ip = req.ip ?? 'unknown'
    const record = hits.get(ip)

    if (!record || record.expires <= now) {
      hits.set(ip, { count: 1, expires: now + windowMs })
      if (hits.size > 5000) sweep(now)
      return next()
    }

    record.count += 1
    if (record.count > max) {
      const retryAfter = Math.ceil((record.expires - now) / 1000)
      res.set('Retry-After', String(retryAfter))
      return res.status(429).json({
        error: message ?? `Slow down — too many ${name} requests. Try again in ${retryAfter}s.`,
      })
    }

    next()
  }
}
