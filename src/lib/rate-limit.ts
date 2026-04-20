/**
 * Simple in-memory rate limiter — no module-level side effects.
 * Cleanup runs lazily on each call so there are no setInterval timers
 * that could hang Next.js during the build phase.
 *
 * Works well on Railway (persistent process).
 * On Vercel each function instance has its own memory, so this limits
 * bursts within a single cold-start instance — still meaningfully
 * reduces abuse. For distributed rate limiting, swap for Upstash Redis.
 */

interface Entry {
  count: number
  resetAt: number
}

const store = new Map<string, Entry>()
let lastClean = 0

function maybeClean() {
  const now = Date.now()
  // Prune at most once every 5 minutes
  if (now - lastClean < 5 * 60 * 1000) return
  lastClean = now
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) store.delete(key)
  }
}

/**
 * @param key      Unique identifier (e.g. IP + route)
 * @param limit    Max requests allowed in the window
 * @param windowMs Time window in milliseconds
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: true } | { ok: false; retryAfterSec: number } {
  maybeClean()
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true }
  }

  if (entry.count >= limit) {
    return { ok: false, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) }
  }

  entry.count++
  return { ok: true }
}

/** Extract the best available IP from a Next.js request */
export function getIp(req: Request): string {
  const forwarded = (req.headers as Headers).get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return 'unknown'
}
